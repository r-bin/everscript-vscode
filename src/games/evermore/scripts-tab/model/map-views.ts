// Ownership: the Scripts tab's Maps view, right column — what one section or
// item of a room blob (./map-sections.ts) looks like. The room is drawn with
// every trigger and object box, each carrying the same key as its item in the
// middle, so the page links picture, list and bytes; an object plays its
// states with the hold of each step. Tiles, metatiles and palettes are
// ./map-tiles.ts. Every picture goes through the maps library's renderer.
// Pure apart from the ROM.
//
// Keys: header | step[:i] | b[:i] | families | fam:i | extras | block1 | anim[:i] |
// objects | area | obj:i[:step] | block2 | cell:x:y | s4 | grass:i | block3 | mt:i | atlas:x:y.

import * as maps from '../../maps';
import { hex } from '../../../../platform';
import { metatilePanels, animPanels, paletteSetPanels, metatileFacts } from './map-tiles';
import type { Panel, Img } from './map-tiles';

type Box = { x: number; y: number; w: number; h: number; cls: string; label: string; key: string; on?: boolean };
type RoomImg = Img & { boxes?: Box[]; pick?: 'cell' | 'atlas'; columns?: number };
type ViewPanel = Omit<Panel, 'image' | 'images'> & { image?: RoomImg; images?: RoomImg[] };

const CELL = 16;
const h4 = (v: number): string => '$' + hex(v, 4);
const png = (img: maps.PixelBuffer, extra: Partial<RoomImg> = {}): RoomImg => ({ uri: maps.encodePngDataUri(img), width: img.width, height: img.height, ...extra });

let _cache: { rom: Uint8Array | null; rooms: Map<number, { room: maps.RoomData; image: RoomImg }> } = { rom: null, rooms: new Map() };

/** The room decoded and drawn once per ROM; panels name the picture `@room` and the page fills it in. */
function roomOf(rom: Uint8Array, id: number) {
    if (_cache.rom !== rom) _cache = { rom, rooms: new Map() };
    let e = _cache.rooms.get(id);
    if (!e) {
        const room = maps.decodeRoom(rom, id);
        e = { room, image: png(maps.renderRoomComposite(rom, room)) };
        _cache.rooms.set(id, e);
    }
    return { room: e.room, picture: { uri: '@room', width: e.image.width, height: e.image.height } as RoomImg };
}

/** The room picture the `@room` panels show: { uri, width, height } or { error }. */
function mapPicture(rom: Uint8Array, id: number): RoomImg | { error: string } {
    try {
        roomOf(rom, id);
        return _cache.rooms.get(id)!.image;
    } catch (err) {
        return { error: String(err instanceof Error ? err.message : err) };
    }
}

/** Every trigger and object as a box keyed like its item; the selection's own box is `on`. */
function overlay(rom: Uint8Array, room: maps.RoomData, picture: RoomImg, sel: string): RoomImg {
    const o = room.header;
    const boxes: Box[] = [];
    const selObj = sel.startsWith('obj:') ? 'obj:' + sel.split(':')[1] : sel;
    (['step', 'b'] as const).forEach((k) => (k === 'step' ? room.triggers.stepOn : room.triggers.bTrigger).forEach((t, i) => boxes.push({
        x: (t.x1 - o.originX) * CELL, y: (t.y1 - o.originY) * CELL, w: Math.max(1, t.x2 - t.x1) * CELL, h: Math.max(1, t.y2 - t.y1) * CELL,
        cls: k, key: k + ':' + i, on: sel === k + ':' + i, label: (k === 'step' ? 'Step-on S' : 'B-trigger B') + i + ' · script ' + h4(t.scriptId),
    })));
    room.objects.forEach((obj) => {
        const b = maps.objectBounds(rom, room, obj);
        if (b) boxes.push({ x: b.x * CELL, y: b.y * CELL, w: b.w * CELL, h: b.h * CELL, cls: 'obj', key: 'obj:' + obj.objectIndex, on: selObj === 'obj:' + obj.objectIndex, label: 'object ' + obj.objectIndex + ' · ' + maps.objectStateCount(obj) + ' states' });
    });
    return { ...picture, boxes };
}

function roomPanel(rom: Uint8Array, room: maps.RoomData, picture: RoomImg, sel: string): ViewPanel {
    return { title: 'Room · ' + room.header.widthTiles + '×' + room.header.heightTiles, image: overlay(rom, room, picture, sel),
        note: 'Every trigger (magenta step-on, yellow B) and object (blue) of the room. Hover one to see its item and bytes; click to open it.' };
}

function triggerPanel(room: maps.RoomData, kind: string, i: number): ViewPanel {
    const t = (kind === 'step' ? room.triggers.stepOn : room.triggers.bTrigger)[i];
    if (!t) return { title: 'Trigger', note: 'No trigger ' + i + '.' };
    return { title: (kind === 'step' ? 'Step-on S' : 'B-trigger B') + i, rows: [
        ['box', '(' + t.x1 + ',' + t.y1 + ')–(' + t.x2 + ',' + t.y2 + ') tiles, x2/y2 exclusive, origin (' + room.header.originX + ',' + room.header.originY + ')'],
        ['script id', h4(t.scriptId) + ' · open it in the Everscript view'],
    ] };
}

/** An object's states as frames: step s takes state s to s+1 and holds `hold` ticks first. */
function objectPanel(rom: Uint8Array, room: maps.RoomData, i: number, step: number | null): ViewPanel {
    const obj = room.objects[i];
    if (!obj) return { title: 'Object', note: 'No object ' + i + '.' };
    const states: RoomImg[] = [];
    for (let s = 0; s < maps.objectStateCount(obj); s++) {
        const img = maps.renderObjectState(rom, room, i, s);
        if (img) states.push(png(img, { label: 'state ' + s, scale: 3, key: s ? 'obj:' + i + ':' + (s - 1) : 'obj:' + i, on: step != null && s === step + 1 }));
    }
    return {
        title: 'Object ' + i + ' · ' + states.length + ' states, ' + obj.states.length + ' steps',
        note: 'The engine walks the steps one after another ($90:A44B): each holds its ticks, then XORs its stamp into the grid. The player plays them with those holds.',
        frames: states.map((s, k) => ({ uri: s.uri, delay: k ? obj.states[k - 1].hold || 1 : 30 })),
        images: states,
        rows: obj.states.map((s, k): [string, string] => ['step ' + k + ' → state ' + (k + 1), 'hold ' + s.hold + ' ticks · stamp at (' + s.tileX + ',' + s.tileY + ') · +' + h4(s.metatileId) + (step === k ? '  ◀' : '')]),
    };
}

/** The right column for one selection key of room `id`: { id, key, panels } or { id, key, error }. */
function mapView(rom: Uint8Array, id: number, key: string) {
    try {
        const { room, picture } = roomOf(rom, id);
        const [kind, a, b] = key.split(':');
        const n = a == null ? null : Number(a);
        let panels: ViewPanel[];
        if (kind === 'header' || kind === 'step' || kind === 'b' || kind === 'objects' || kind === 'area' || kind === 'obj') {
            panels = [roomPanel(rom, room, picture, key)];
            if ((kind === 'step' || kind === 'b') && n != null) panels.unshift(triggerPanel(room, kind, n));
            if (kind === 'obj') panels.unshift(objectPanel(rom, room, n ?? 0, b == null ? null : Number(b)));
        } else if (kind === 'families' || kind === 'fam') panels = paletteSetPanels(rom, room, n);
        else if (kind === 'block1') {
            const a1 = maps.renderTileListAtlas(rom, room, { palette: 1 });
            panels = [{ title: 'Graphics list · ' + a1.count + ' graphics', note: 'In BG palette 1; the last ' + room.animatedTiles.length + ' are the animation channels\' first frames.', image: png(a1.image) }];
        } else if (kind === 'anim') panels = n == null ? [{ title: 'Animated tiles', note: room.animation.length + ' channels: pick one in the middle.' }] : animPanels(rom, room, n);
        else if (kind === 'block2') panels = [{ title: 'Map · ' + room.header.widthTiles + '×' + room.header.heightTiles, note: 'Click a cell to take its metatile apart.', image: { ...picture, pick: 'cell' } }];
        else if (kind === 'cell') {
            const id2 = room.layer1MetatileIds[Number(b)]?.[n ?? 0];
            panels = id2 == null ? [{ title: 'Cell', note: 'Outside the map.' }] : metatilePanels(rom, room, maps.metatileIndex(room, id2));
            panels[0].title = 'Cell (' + n + ',' + b + ') · ' + panels[0].title;
        } else if (kind === 's4') panels = [{ title: 'Cuttable tiles', note: room.cuttableGrass.table.records.length + ' swap chains, ' + room.cuttableGrass.tiles.length + ' cuttable cells. Pick a chain in the middle.' }];
        else if (kind === 'grass') {
            const r = room.cuttableGrass.table.records[n ?? 0];
            panels = r ? metatilePanels(rom, room, maps.metatileIndex(room, r.source)) : [{ title: 'Cuttable tile', note: 'No swap record ' + n + '.' }];
        } else if (kind === 'block3' || kind === 'atlas' || kind === 'mt') {
            const at = maps.renderMetatileAtlas(rom, room, { columns: 16 });
            const idx = kind === 'atlas' ? Number(b) * at.columns + (n ?? 0) : kind === 'mt' ? n : null;
            const facts = metatileFacts(rom, room);
            const counts = ['grass', 'channels', 'steps'].map((f) => facts.filter((x) => (x as unknown as Record<string, unknown[]>)[f].length).length);
            panels = [{ title: 'Metatiles · ' + at.count, note: counts[0] + ' cuttable, ' + counts[1] + ' animated, ' + counts[2] + ' placed by objects. Click one to see all its states.', image: png(at.image, { pick: 'atlas', columns: at.columns }) }];
            if (idx != null && idx < at.count) panels = metatilePanels(rom, room, idx).concat(panels);
        } else panels = [{ title: room.header.widthTiles + '×' + room.header.heightTiles + ' tiles', image: picture,
            note: kind === 'extras' ? 'The descriptors are listed in the middle; what the loader does with them is not decoded yet.' : undefined }];
        return { id, key, panels };
    } catch (err) {
        return { id, key, error: String(err instanceof Error ? err.message : err) };
    }
}

export { mapView, mapPicture };
export type { ViewPanel, RoomImg, Box };
