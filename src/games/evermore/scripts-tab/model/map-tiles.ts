// Ownership: the Scripts tab's Maps view, what a room's tiles are — each
// metatile with everything that changes it (a cuttable tile's swap chain, the
// animation channels its words name, the object steps that stamp it), a
// metatile taken apart into its layers and collision, an animation channel's
// frames, and the map palette sets. Every picture goes through the maps
// library's renderer. Pure apart from the ROM.

import * as maps from '../../maps';
import { hex } from '../../../../platform';

type Img = { uri: string; width: number; height: number; label?: string; scale?: number; key?: string; on?: boolean };
type PaletteSet = { title: string; note: string; rows: { label: string; colors: string[] | null; key?: string; on?: boolean }[] };
type Panel = { title: string; note?: string; image?: Img; images?: Img[]; rows?: [string, string][]; frames?: { uri: string; delay: number }[]; sets?: PaletteSet[] };
type Facts = { index: number; id: number; label: string; grass: number[]; channels: number[]; steps: string[] };

const CELL = 16;
const SET = 7;
const h4 = (v: number): string => '$' + hex(v, 4);
const png = (img: maps.PixelBuffer, extra: Partial<Img> = {}): Img => ({ uri: maps.encodePngDataUri(img), width: img.width, height: img.height, ...extra });
const slotOf = (w: number): number => { const chr = w & 0x3ff; return Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2); };

/** One metatile's two words drawn alone and composited (with `animatedTiles` swapped in for an animation frame). */
function cellImages(rom: Uint8Array, room: maps.RoomData, w1: number, w2: number, animatedTiles = room.animatedTiles) {
    const mini: maps.RoomData = {
        ...room, animatedTiles, layer1VramWords: [[w1]], layer2VramWords: [[w2]],
        header: { ...room.header, widthTiles: 1, heightTiles: 1, widthPixels: CELL, heightPixels: CELL },
    };
    const bg1 = maps.renderVramLayer(rom, mini, [[w1]]);
    const bg2 = maps.renderVramLayer(rom, mini, [[w2]]);
    return { composite: maps.compositeLayers(mini, bg1, bg2), bg1, bg2 };
}

const _facts = new WeakMap<maps.RoomData, Facts[]>();
/** Per metatile: the swap chains it is in, the animation channels its words name, the object steps that put it in the grid. */
function metatileFacts(rom: Uint8Array, room: maps.RoomData): Facts[] {
    const cached = _facts.get(room);
    if (cached) return cached;
    const table = maps.metatileTable(room);
    const byId = new Map(table.map((t) => [t.id, t]));
    const facts: Facts[] = table.map((t) => ({ index: t.index, id: t.id, label: '', grass: [], channels: [], steps: [] }));
    const at = (id: number) => facts[maps.metatileIndex(room, id)];
    room.cuttableGrass.table.records.forEach((r, i) => [r.source].concat(r.sequence).forEach((id) => at(id)?.grass.push(i)));
    const base = room.tilePalette.length;
    table.forEach((t) => [t.layer1, t.layer2].forEach((w) => { const ch = slotOf(w) - base; if (ch >= 0 && ch < room.animation.length && !facts[t.index].channels.includes(ch)) facts[t.index].channels.push(ch); }));
    room.objects.forEach((o) => {
        const box = maps.objectBounds(rom, room, o);
        if (!box) return;
        for (let s = 1; s < maps.objectStateCount(o); s++) {
            const g = maps.applyObjectStates(rom, room, { [o.objectIndex]: s }).layer1MetatileIds;
            for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
                const id = g[y]?.[x];
                if (id != null && id !== room.layer1MetatileIds[y][x] && byId.has(id) && !at(id).steps.includes(o.objectIndex + ':' + s)) at(id).steps.push(o.objectIndex + ':' + s);
            }
        }
    });
    facts.forEach((f, i) => {
        const tags = [f.grass.length && 'cuttable', f.channels.length && 'animated', f.steps.length && 'object state'].filter(Boolean);
        f.label = 'metatile ' + i + ' · ' + h4(f.id) + ' · ' + table[i].uses + ' cells' + (tags.length ? ' · ' + tags.join(', ') : '');
    });
    _facts.set(room, facts);
    return facts;
}

/** The collision word's 16×16 shape for the Boy on its plane: solid pixels red. */
function collisionImage(cw: number): maps.PixelBuffer {
    const mask = maps.geometryMask(maps.passability(cw, maps.tilePlane(cw)));
    const data = new Uint8Array(CELL * CELL * 4);
    mask.forEach((m, i) => data.set(m ? [230, 70, 70, 255] : [60, 160, 90, 110], i * 4));
    return { width: CELL, height: CELL, data };
}

function wordRow(room: maps.RoomData, label: string, w: number): [string, string] {
    const slot = slotOf(w), graphics = room.tilePalette.concat(room.animatedTiles);
    const from = slot < room.tilePalette.length ? 'graphic ' + h4(graphics[slot] ?? 0) : slot < graphics.length ? 'animated channel ' + (slot - room.tilePalette.length) : 'none';
    return [label, h4(w) + ' · slot ' + slot + ' (' + from + ') · BG palette ' + ((w >> 10) & 7) + ' · priority ' + ((w >> 13) & 1) + ((w & 0x4000) ? ' · h-flip' : '') + ((w & 0x8000) ? ' · v-flip' : '')];
}

/** A metatile taken apart, then every state it can be in: its swap chain, its animation frames, the object steps that stamp it. */
function metatilePanels(rom: Uint8Array, room: maps.RoomData, index: number): Panel[] {
    const t = maps.metatileTable(room)[index];
    if (!t) return [{ title: 'Metatile', note: 'No metatile ' + index + ' in this room.' }];
    const f = metatileFacts(rom, room)[index];
    const im = cellImages(rom, room, t.layer1, t.layer2);
    const cw = t.collision, gate = maps.entityGate(cw);
    const flags = [maps.isPlaneTransparent(cw) && 'plane-transparent', maps.isAlwaysWalkable(cw) && 'always walkable', maps.spriteDrawsInFront(cw) && 'sprite in front', maps.spriteHiddenOn(cw) && 'sprite hidden'].filter(Boolean).join(' · ');
    const out: Panel[] = [{
        title: 'Metatile ' + index + ' · id ' + h4(t.id) + ' · ' + t.uses + ' cells',
        images: [png(im.composite, { label: 'composite', scale: 5 }), png(im.bg1, { label: 'BG1 canopy', scale: 5 }), png(im.bg2, { label: 'BG2 terrain', scale: 5 }), png(collisionImage(cw), { label: 'collision', scale: 5 })],
        rows: [wordRow(room, 'BG1 word', t.layer1), wordRow(room, 'BG2 word', t.layer2),
            ['collision word', h4(cw) + ' · geometry ' + h4(cw & 0xf) + ' · plane ' + maps.tilePlane(cw) + (gate >= 0 ? ' · entity gate ' + gate : '') + (flags ? ' · ' + flags : '')]],
    }];
    const table = maps.metatileTable(room);
    const tile = (id: number, label: string, key?: string): Img => {
        const m = table[maps.metatileIndex(room, id)];
        return png(m ? cellImages(rom, room, m.layer1, m.layer2).composite : { width: CELL, height: CELL, data: new Uint8Array(CELL * CELL * 4) }, { label, scale: 4, key, on: id === t.id });
    };
    f.grass.forEach((i) => {
        const r = room.cuttableGrass.table.records[i];
        out.push({ title: 'Cut: swap chain ' + i, note: 'Cutting replaces the metatile one step at a time (' + r.steps + ' steps).',
            images: [r.source].concat(r.sequence).map((id, k) => tile(id, (k ? 'step ' + k : 'uncut') + ' · ' + h4(id), 'mt:' + maps.metatileIndex(room, id))) });
    });
    f.channels.forEach((ch) => {
        const c = room.animation[ch];
        out.push({ title: 'Animated: channel ' + ch, note: 'The metatile as each frame of the channel draws it.', frames: c.frames.map((fr) => {
            const tiles = room.animatedTiles.slice();
            tiles[ch] = fr.tileId;
            return { uri: maps.encodePngDataUri(cellImages(rom, room, t.layer1, t.layer2, tiles).composite), delay: fr.delay };
        }) });
    });
    if (f.steps.length) out.push({ title: 'Placed by an object', note: 'The object states that put this metatile in the grid.', rows: f.steps.map((k): [string, string] => ['object ' + k.split(':')[0], 'state ' + k.split(':')[1]]) });
    return out;
}

/** A channel's frames in the slot it animates, in the BG palette the first cell naming the slot uses. */
function animPanels(rom: Uint8Array, room: maps.RoomData, ch: number): Panel[] {
    const c = room.animation[ch];
    if (!c) return [{ title: 'Animated tiles', note: 'No channel ' + ch + '.' }];
    const slot = room.tilePalette.length + ch, chr = maps.tileSlotChr(slot);
    let pal = 1;
    find: for (const grid of [room.layer2VramWords, room.layer1VramWords]) for (const row of grid) for (const w of row) {
        if ((w & 0x3ff) === chr) { pal = (w >> 10) & 7; break find; }
    }
    const word = chr | (pal << 10);
    const users = metatileFacts(rom, room).filter((f) => f.channels.includes(ch));
    return [{
        title: 'Channel ' + ch + ' · slot ' + slot, note: 'Plays at 60 ticks/s in BG palette ' + pal + ': each frame loads a graphic into the slot for its delay. ' + users.length + ' metatiles use it.',
        frames: c.frames.map((fr) => { const tiles = room.animatedTiles.slice(); tiles[ch] = fr.tileId; return { uri: maps.encodePngDataUri(maps.renderVramLayer(rom, { ...room, animatedTiles: tiles, header: { ...room.header, widthTiles: 1, heightTiles: 1, widthPixels: CELL, heightPixels: CELL } }, [[word]])), delay: fr.delay }; }),
        rows: c.frames.map((fr, i): [string, string] => ['frame ' + i, 'graphic ' + h4(fr.tileId) + ' · ' + fr.delay + ' ticks']),
    }];
}

/** The map palettes as the loader sees them: sets of 7, the set picked by `$7E:2437`, empty slots marked. */
function paletteSetPanels(rom: Uint8Array, room: maps.RoomData, sel: number | null): Panel[] {
    const fams = room.tileFamilies;
    const sets: PaletteSet[] = [];
    for (let s = 0; s * SET < Math.max(1, fams.length); s++) {
        const rows: PaletteSet['rows'] = [];
        for (let k = 0; k < SET; k++) {
            const i = s * SET + k, f = fams[i];
            rows.push(f == null ? { label: 'BG palette ' + (k + 1) + ' · empty: not loaded, keeps what CGRAM held', colors: null }
                : { label: 'BG palette ' + (k + 1) + ' ← #' + f, colors: maps.extractTileFamilyPalette(rom, f).map((c) => '#' + [c[0], c[1], c[2]].map((v) => hex(v, 2)).join('')), key: 'fam:' + i, on: i === sel });
        }
        sets.push({ title: 'Set ' + (s + 1) + ' · $7E:2437 = ' + s * SET, note: s ? 'Loaded when a script sets $7E:2437 to ' + s * SET + ' ($90:CBB3 reloads when it differs from $0F8A).' : 'Loaded with the room ($7E:2437 = 0).', rows });
    }
    return [{ title: 'Map palettes · ' + fams.length + ' listed', note: 'Each id is a 16-colour palette in the table $9C:C322 (the room format calls it a tile family). $90:D020 copies up to 7, starting at $7E:2437, into BG palettes 1–7.', sets }];
}

export { metatileFacts, metatilePanels, animPanels, paletteSetPanels };
export type { Panel, Img, PaletteSet };
