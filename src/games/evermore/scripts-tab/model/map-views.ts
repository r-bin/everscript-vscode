// Ownership: the Scripts tab's Maps view, right column — what one section or
// item of a room blob (./map-sections.ts) looks like: the room with its
// trigger and object boxes, the graphics list, an animation channel's frames,
// a metatile taken apart into its two layers and collision, a cuttable tile's
// swap chain. Every picture goes through the maps library's renderer, so it is
// the room's own palettes, priority and colour math. Pure apart from the ROM.
//
// Keys: header | step[:i] | b[:i] | families | extras | block1 | anim[:i] |
// objects | area | obj:i | block2 | cell:x:y | s4 | grass:i | block3 | mt:i | atlas:x:y.

import * as maps from '../../maps';
import { hex } from '../../../../platform';

type Box = { x: number; y: number; w: number; h: number; cls: string; label: string; key?: string; on?: boolean };
type Img = { uri: string; width: number; height: number; label?: string; scale?: number; boxes?: Box[]; pick?: 'cell' | 'atlas'; columns?: number };
type Panel = { title: string; note?: string; image?: Img; images?: Img[]; rows?: [string, string][]; swatches?: string[][]; frames?: { uri: string; delay: number }[] };

const CELL = 16;
const h4 = (v: number): string => '$' + hex(v, 4);
const png = (img: maps.PixelBuffer, extra: Partial<Img> = {}): Img => ({ uri: maps.encodePngDataUri(img), width: img.width, height: img.height, ...extra });

let _cache: { rom: Uint8Array | null; rooms: Map<number, { room: maps.RoomData; image: Img }> } = { rom: null, rooms: new Map() };

/** The room decoded and drawn once per ROM; panels name the picture `@room` and the page fills it in. */
function roomOf(rom: Uint8Array, id: number) {
    if (_cache.rom !== rom) _cache = { rom, rooms: new Map() };
    let e = _cache.rooms.get(id);
    if (!e) {
        const room = maps.decodeRoom(rom, id);
        e = { room, image: png(maps.renderRoomComposite(rom, room)) };
        _cache.rooms.set(id, e);
    }
    return { room: e.room, picture: { uri: '@room', width: e.image.width, height: e.image.height } as Img };
}

/** The room picture the `@room` panels show: { uri, width, height } or { error }. */
function mapPicture(rom: Uint8Array, id: number): Img | { error: string } {
    try {
        roomOf(rom, id);
        return _cache.rooms.get(id)!.image;
    } catch (err) {
        return { error: String(err instanceof Error ? err.message : err) };
    }
}

/** A synthetic room `w`×`h` cells big with these tilemaps; everything else (families, graphics, registers) is the room's. */
function sheet(room: maps.RoomData, l1: number[][], l2: number[][], animatedTiles = room.animatedTiles): maps.RoomData {
    const h = l1.length, w = l1[0].length;
    return {
        ...room, animatedTiles,
        header: { ...room.header, widthTiles: w, heightTiles: h, widthPixels: w * CELL, heightPixels: h * CELL },
        layer1VramWords: l1, layer2VramWords: l2,
    };
}

/** One metatile's two words drawn alone and composited. */
function cellImages(rom: Uint8Array, room: maps.RoomData, w1: number, w2: number, animatedTiles?: number[]) {
    const mini = sheet(room, [[w1]], [[w2]], animatedTiles);
    const bg1 = maps.renderVramLayer(rom, mini, [[w1]]);
    const bg2 = maps.renderVramLayer(rom, mini, [[w2]]);
    return { composite: maps.compositeLayers(mini, bg1, bg2), bg1, bg2 };
}

/** The collision word's 16×16 shape: solid pixels opaque red. */
function collisionImage(cw: number, plane: number): maps.PixelBuffer {
    const mask = maps.geometryMask(maps.passability(cw, plane));
    const data = new Uint8Array(CELL * CELL * 4);
    mask.forEach((m, i) => { if (m) data.set([230, 70, 70, 255], i * 4); else data.set([60, 160, 90, 110], i * 4); });
    return { width: CELL, height: CELL, data };
}

function wordRows(room: maps.RoomData, label: string, w: number): [string, string][] {
    const chr = w & 0x3ff, slot = Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2);
    const graphics = room.tilePalette.concat(room.animatedTiles);
    const from = slot < room.tilePalette.length ? 'graphic ' + h4(graphics[slot] ?? 0) : slot < graphics.length ? 'animated channel ' + (slot - room.tilePalette.length) : 'none';
    return [[label, h4(w) + ' · slot ' + slot + ' (' + from + ') · palette ' + ((w >> 10) & 7) + ' · priority ' + ((w >> 13) & 1) +
        ((w & 0x4000) ? ' · h-flip' : '') + ((w & 0x8000) ? ' · v-flip' : '')]];
}

function metatilePanels(rom: Uint8Array, room: maps.RoomData, index: number): Panel[] {
    const t = maps.metatileTable(room)[index];
    if (!t) return [{ title: 'Metatile', note: 'No metatile ' + index + ' in this room.' }];
    const im = cellImages(rom, room, t.layer1, t.layer2);
    const plane = maps.tilePlane(t.collision), gate = maps.entityGate(t.collision);
    const flags = [maps.isPlaneTransparent(t.collision) && 'plane-transparent', maps.isAlwaysWalkable(t.collision) && 'always walkable',
        maps.spriteDrawsInFront(t.collision) && 'sprite in front', maps.spriteHiddenOn(t.collision) && 'sprite hidden'].filter(Boolean).join(' · ');
    return [{
        title: 'Metatile ' + index + ' · id ' + h4(t.id),
        note: 'Taken apart: the composite the room draws, BG1 (canopy) and BG2 (terrain) alone, and the Boy\'s collision on its plane.',
        images: [png(im.composite, { label: 'composite', scale: 6 }), png(im.bg1, { label: 'BG1 canopy', scale: 6 }), png(im.bg2, { label: 'BG2 terrain', scale: 6 }),
            png(collisionImage(t.collision, plane), { label: 'collision', scale: 6 })],
        rows: [
            ...wordRows(room, 'BG1 word', t.layer1), ...wordRows(room, 'BG2 word', t.layer2),
            ['collision word', h4(t.collision) + ' · geometry ' + h4(t.collision & 0xf) + ' · plane ' + plane + (gate >= 0 ? ' · entity gate ' + gate : '') + (flags ? ' · ' + flags : '')],
            ['placed', t.uses + ' cells'],
        ],
    }];
}

function triggerPanels(room: maps.RoomData, picture: Img, kind: string, sel: number | null): Panel[] {
    const o = room.header;
    const boxes: Box[] = [];
    (['step', 'b'] as const).forEach((k) => (k === 'step' ? room.triggers.stepOn : room.triggers.bTrigger).forEach((t, i) => boxes.push({
        x: (t.x1 - o.originX) * CELL, y: (t.y1 - o.originY) * CELL, w: Math.max(1, t.x2 - t.x1) * CELL, h: Math.max(1, t.y2 - t.y1) * CELL,
        cls: k, key: k + ':' + i, on: k === kind && i === sel, label: (k === 'step' ? 'Step-on S' : 'B-trigger B') + i + ' · script ' + h4(t.scriptId),
    })));
    const list = kind === 'step' ? room.triggers.stepOn : room.triggers.bTrigger;
    const t = sel != null ? list[sel] : null;
    return [{
        title: kind === 'step' ? 'Step-on triggers' : 'B-triggers', image: { ...picture, boxes },
        rows: t ? [['box', '(' + t.x1 + ',' + t.y1 + ')–(' + t.x2 + ',' + t.y2 + ') tiles, x2/y2 exclusive, origin (' + o.originX + ',' + o.originY + ')'],
            ['script id', h4(t.scriptId) + ' · open it in the Everscript view']] : undefined,
    }];
}

function animPanels(rom: Uint8Array, room: maps.RoomData, ch: number): Panel[] {
    const c = room.animation[ch];
    if (!c) return [{ title: 'Animated tiles', note: 'No channel ' + ch + '.' }];
    const slot = room.tilePalette.length + ch;
    const chr = maps.tileSlotChr(slot);
    // The palette the room draws the channel in: the first cell word that names its slot.
    let pal = 1;
    find: for (const grid of [room.layer2VramWords, room.layer1VramWords]) for (const row of grid) for (const w of row) {
        if ((w & 0x3ff) === chr) { pal = (w >> 10) & 7; break find; }
    }
    const frames = c.frames.map((f) => {
        const tiles = room.animatedTiles.slice();
        tiles[ch] = f.tileId;
        const word = chr | (pal << 10);
        return { uri: maps.encodePngDataUri(maps.renderVramLayer(rom, sheet(room, [[word]], [[word]], tiles), [[word]])), delay: f.delay };
    });
    return [{
        title: 'Channel ' + ch + ' · slot ' + slot, frames,
        note: 'Plays the channel at 60 ticks/s in palette ' + pal + ': each frame loads a graphic into the slot for its delay.',
        rows: c.frames.map((f, i): [string, string] => ['frame ' + i, 'graphic ' + h4(f.tileId) + ' · ' + f.delay + ' ticks']),
    }];
}

function objectPanels(rom: Uint8Array, room: maps.RoomData, picture: Img, i: number): Panel[] {
    const obj = room.objects[i];
    if (!obj) return [{ title: 'Object', note: 'No object ' + i + '.' }];
    const b = maps.objectBounds(rom, room, obj);
    const states: Img[] = [];
    for (let s = 0; s < maps.objectStateCount(obj); s++) {
        const img = maps.renderObjectState(rom, room, i, s);
        if (img) states.push(png(img, { label: 'state ' + s, scale: 2 }));
    }
    return [
        { title: 'Object ' + i + ' · ' + states.length + ' states', images: states, rows: obj.states.map((s): [string, string] =>
            ['→ state ' + (s.state + 1), 'stamp ' + s.targetWidth + '×' + s.targetHeight + ' at (' + s.tileX + ',' + s.tileY + ') · hold ' + s.hold + ' ticks · +' + h4(s.metatileId)]) },
        { title: 'In the room', image: { ...picture, boxes: b ? [{ x: b.x * CELL, y: b.y * CELL, w: b.w * CELL, h: b.h * CELL, cls: 'obj', on: true, label: 'object ' + i }] : [] } },
    ];
}

function grassPanels(rom: Uint8Array, room: maps.RoomData, i: number): Panel[] {
    const r = room.cuttableGrass.table.records[i];
    if (!r) return [{ title: 'Cuttable tile', note: 'No swap record ' + i + '.' }];
    const chain = [r.source].concat(r.sequence);
    const t = maps.metatileTable(room);
    const images = chain.map((id, k) => {
        const m = t[maps.metatileIndex(room, id)];
        return png(m ? cellImages(rom, room, m.layer1, m.layer2).composite : { width: CELL, height: CELL, data: new Uint8Array(CELL * CELL * 4) },
            { label: (k ? 'step ' + k : 'uncut') + ' · ' + h4(id), scale: 5 });
    });
    const at = room.cuttableGrass.tiles.filter(([x, y]) => room.layer1MetatileIds[y][x] === r.source).length;
    return [{ title: 'Swap ' + i + ' · ' + r.steps + ' steps', note: 'Cutting replaces the metatile step by step; ' + at + ' cells of this room start as it.', images }];
}

/** The right column for one selection key of room `id`: { id, key, panels } or { id, key, error }. */
function mapView(rom: Uint8Array, id: number, key: string) {
    try {
        const { room, picture } = roomOf(rom, id);
        const [kind, a, b] = key.split(':');
        const n = a == null ? null : Number(a);
        let panels: Panel[];
        if (kind === 'step' || kind === 'b') panels = triggerPanels(room, picture, kind, n);
        else if (kind === 'families') {
            panels = [{ title: 'Background palettes 1–7', note: 'One tile family per palette; colour 0 is transparent.',
                swatches: maps.buildRoomCgramPalettes(rom, room.tileFamilies).slice(1).map((p) => p.map((c) => '#' + [c[0], c[1], c[2]].map((v) => hex(v, 2)).join(''))) }];
        } else if (kind === 'block1') {
            const a1 = maps.renderTileListAtlas(rom, room, { palette: 1 });
            panels = [{ title: 'Graphics list · ' + a1.count + ' graphics', note: 'In background palette 1; the last ' + room.animatedTiles.length + ' are the animation channels\' first frames.', image: png(a1.image) }];
        } else if (kind === 'anim') panels = n == null ? [{ title: 'Animated tiles', note: room.animation.length + ' channels: pick one in the middle.' }] : animPanels(rom, room, n);
        else if (kind === 'obj') panels = objectPanels(rom, room, picture, n ?? 0);
        else if (kind === 'objects' || kind === 'area') panels = [{ title: room.objects.length + ' objects', note: 'Pick one in the middle.', image: picture }];
        else if (kind === 'block2') panels = [{ title: 'Map · ' + room.header.widthTiles + '×' + room.header.heightTiles, note: 'Click a cell to take its metatile apart.', image: { ...picture, pick: 'cell' } }];
        else if (kind === 'cell') {
            const id2 = room.layer1MetatileIds[Number(b)]?.[n ?? 0];
            panels = id2 == null ? [{ title: 'Cell', note: 'Outside the map.' }] : metatilePanels(rom, room, maps.metatileIndex(room, id2));
            panels[0].title = 'Cell (' + n + ',' + b + ') · ' + panels[0].title;
        } else if (kind === 's4') panels = [{ title: 'Cuttable tiles', note: room.cuttableGrass.table.records.length + ' swap chains, ' + room.cuttableGrass.tiles.length + ' cuttable cells.' }];
        else if (kind === 'grass') panels = grassPanels(rom, room, n ?? 0);
        else if (kind === 'block3' || kind === 'atlas') {
            const at = maps.renderMetatileAtlas(rom, room, { columns: 16 });
            const idx = kind === 'atlas' ? Number(b) * at.columns + (n ?? 0) : null;
            panels = [{ title: 'Metatiles · ' + at.count, note: 'Click one to take it apart.', image: png(at.image, { pick: 'atlas', columns: at.columns }) }];
            if (idx != null && idx < at.count) panels = metatilePanels(rom, room, idx).concat(panels);
        } else if (kind === 'mt') panels = metatilePanels(rom, room, n ?? 0);
        else panels = [{ title: room.header.widthTiles + '×' + room.header.heightTiles + ' tiles', image: picture,
            note: kind === 'extras' ? 'The descriptors are listed in the middle; what the loader does with them is not decoded yet.' : undefined }];
        return { id, key, panels };
    } catch (err) {
        return { id, key, error: String(err instanceof Error ? err.message : err) };
    }
}

export { mapView, mapPicture };
export type { Panel, Img, Box };
