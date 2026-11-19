// Ownership: a room as the files of an Open Evermore tree (docs/open-evermore/resources.md §maps) and back:
// map.json (header, families, palette cycles, graphics, animations, triggers, cuttable grass), grid.txt (the cells),
// metatiles.json (what each metatile draws and how it collides) and objects.json (each object's states). Pure:
// values in, values out; the tool (tools/open-evermore) and the Rooms tab (rooms/tree-rooms.ts) do the files.
// Every byte of a vanilla room comes back (explode checks it); references to other kinds are names.
//
// Facts used (room-reference.md):
//   graphics    Block 1: 16-bit deltas summed into tile ids ($90:8E85)
//   grid        Block 2, always Markov; ids are base + 8·index with base = 2·width·height; the first counter is
//               Section 4's first byte
//   metatiles   Block 3: three slices of words, canopy, terrain, collision
//   animations  Section 2: [count][len:2], count × [countdown, frames, offset:2], 0xFF, frames × [ticks, tile:2];
//               canonical (offsets ascend, each channel's frames follow the last), so it is rebuilt from the list
//   compression noted, not stored: our `lzssCompressVanilla` gives back 237 of the 241 vanilla LZSS blocks; the
//               other four carry `packed` (their vanilla bytes) while those still unpack to the data

import { buildBlob, encodeBlock1, encodeBlock2, lzssCompressVanilla, unpackBlock, SUB_LZSS, SUB_RAW } from './encode';
import type { Block, RoomModel, TriggerRecord } from './encode';
import { decompressMarkovGrid } from './markov';
import { collisionText, grassText, hexN, layerText, objectsText, parseCollision, parseGrass, parseLayer, parseObjects, slotNames } from './tree-map-text';
import type { Cells } from './tree-map-text';

export const TREE_MAP = { map: 'map.json', grid: 'grid.txt', metatiles: 'metatiles.json', objects: 'objects.json' } as const;
export type TreeMapFile = (typeof TREE_MAP)[keyof typeof TREE_MAP];
export const TREE_MAP_VERSION = 6;
const FORMAT = 'open-evermore/map', META_FORMAT = 'open-evermore/metatiles', OBJ_FORMAT = 'open-evermore/objects';
/** Animation channels the engine runs ($90:A1B4 scans 50). */
const MAX_CHANNELS = 50;

/** A room's files as values: JSON already parsed, grid.txt as text. */
export interface TreeMapFiles { map: any; grid: string; metatiles: any; objects: any }
/** Names for other kinds' ids (explode). */
export interface TreeNames { family(id: number): string; tile(id: number): string }
/** Ids for other kinds' names (implode, the Rooms tab); `dma`: the tile is an animation frame (streamed raw). */
export interface TreeRefs { family(name: string): number | undefined; tile(name: string, dma: boolean): number | undefined }
export interface TreeProblem { level: 'error' | 'info'; code: string; file: TreeMapFile; pointer: string; message: string }

interface Channel { countdown: number; frames: { ticks: number; tile: number }[] }

/** Block 1's payload → tile ids, and back. */
function graphicIds(b: Block): number[] {
    const raw = unpackBlock(b), ids: number[] = [];
    let acc = 0;
    for (let i = 0; i + 1 < raw.length; i += 2) ids.push(acc = (acc + (raw[i] | (raw[i + 1] << 8))) & 0xFFFF);
    return ids;
}
const graphicPayload = (ids: number[]) => unpackBlock(encodeBlock1(ids, false));

function channels(count: number, d: Uint8Array): Channel[] {
    return Array.from({ length: count }, (_, c) => {
        const n = d[c * 4 + 1], offset = d[c * 4 + 2] | (d[c * 4 + 3] << 8);
        return { countdown: d[c * 4], frames: Array.from({ length: n }, (_, k) => ({ ticks: d[offset + k * 3], tile: d[offset + k * 3 + 1] | (d[offset + k * 3 + 2] << 8) })) };
    });
}
function section2Bytes(list: Channel[]): Uint8Array {
    const out: number[] = [];
    let offset = list.length * 4 + 1;
    for (const c of list) { out.push(c.countdown, c.frames.length, offset & 0xFF, offset >> 8); offset += c.frames.length * 3; }
    out.push(0xFF);
    for (const c of list) for (const f of c.frames) out.push(f.ticks, f.tile & 0xFF, f.tile >> 8);
    return Uint8Array.from(out);
}

const b64 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
/** How a payload is stored: our compressor's choice, plus the vanilla bytes only where it does not reproduce them. */
function stored(b: Block): { compression: string; packed?: string } {
    if (b.sub === SUB_RAW) return { compression: 'none' };
    const ours = lzssCompressVanilla(unpackBlock(b));
    return ours.length === b.data.length && ours.every((x, i) => x === b.data[i]) ? { compression: 'lzss' } : { compression: 'lzss', packed: b64(b.data) };
}
const wordsOf = (raw: Uint8Array) => Array.from({ length: raw.length >> 1 }, (_, i) => raw[i * 2] | (raw[i * 2 + 1] << 8));

/** The room's cells as metatile indices. */
function cellsOf(m: RoomModel, count: number): Cells {
    const width = m.header[2], height = m.header[3], base = 2 * width * height;
    const ids: number[] = decompressMarkovGrid(m.block2.data, 0, width, height, base, m.section4.length ? m.section4[0] : 0);
    return { width, height, base, count, cells: ids.map(id => (id - base) / 8) };
}

/** A room's files, other kinds named by `names`. */
export function roomToTree(m: RoomModel, names: TreeNames): TreeMapFiles {
    const h = m.header, ids = graphicIds(m.block1), anim = channels(m.section2Count, m.section2Data);
    const slots = slotNames(ids.map(names.tile));
    const trigger = (t: TriggerRecord) => ({ from: [t.x1, t.y1], to: [t.x2, t.y2], script: t.scriptId });
    const cycles = [];
    for (let i = 0; i + 2 < m.extras.length; i += 3) cycles.push({ start: m.extras[i], colours: m.extras[i + 1], rate: (m.extras[i + 2] << 24) >> 24 });
    const words = wordsOf(unpackBlock(m.block3)), n = words.length / 3;
    const room = cellsOf(m, n);
    const digits = Math.max(3, Math.max(0, ...room.cells, n - 1).toString(16).length);
    const grass = grassText(m.section4, room.base, n, digits);
    const map = {
        format: FORMAT, version: TREE_MAP_VERSION,
        header: {
            triggerOrigin: [h[0], h[1]], mainScreen: h[4], subScreen: h[5], colourMath: h[6], colourWindow: h[7], effect: h[8],
            cameraFlags: h[9] | (h[10] << 8), reserved: h[11] | (h[12] << 8),
        },
        tileFamilies: m.tileFamilies.map(names.family),
        paletteCycles: cycles,
        graphics: { ...stored(m.block1), tiles: ids.map(names.tile) },
        animations: anim.map(c => ({ countdown: c.countdown, frames: c.frames.map(f => ({ ticks: f.ticks, tile: names.tile(f.tile) })) })),
        stepOn: m.stepOn.map(trigger),
        bTrigger: m.bTrigger.map(trigger),
        cuttableGrass: grass.list,
        ...(grass.sources !== undefined ? { grassSources: grass.sources } : {}),
    };
    const grid = Array.from({ length: room.height }, (_, y) => room.cells.slice(y * room.width, (y + 1) * room.width).map(c => hexN(c, digits)).join(' ')).join('\n') + '\n';
    const metatiles = {
        format: META_FORMAT, version: 1, ...stored(m.block3),
        list: Array.from({ length: n }, (_, k) => ({
            id: hexN(k, digits), canopy: layerText(words[k], slots, anim.length), terrain: layerText(words[n + k], slots, anim.length), collision: collisionText(words[2 * n + k]),
        })),
    };
    const objects = { format: OBJ_FORMAT, version: 1, list: objectsText(m.objectOffsets, m.objectArea, room, digits) };
    return { map, grid, metatiles, objects };
}

/** The room the files describe, or null; every problem goes to `report` with its file and JSON pointer (grid.txt: /row/column). */
export function roomFromTree(f: TreeMapFiles, refs: TreeRefs, report: (p: TreeProblem) => void): RoomModel | null {
    const badIn = (file: TreeMapFile) => (pointer: string, message: string, code = 'invalid-value') => { report({ level: 'error', code, file, pointer, message }); return null; };
    const bad = badIn(TREE_MAP.map), badMeta = badIn(TREE_MAP.metatiles), badGrid = badIn(TREE_MAP.grid), badObj = badIn(TREE_MAP.objects);
    const isByte = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 0xFF;
    const isWord = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 0xFFFF;
    /** A payload under its noted compression: the kept vanilla bytes while they still unpack to it, else ours. */
    const pack = (payload: Uint8Array, g: any, p: string, file: TreeMapFile): Block | null => {
        if (g.compression === 'none') return { sub: SUB_RAW, decomp: payload.length, data: payload };
        if (g.compression !== 'lzss') return badIn(file)(p + '/compression', '"lzss" or "none"');
        if (g.packed !== undefined) {
            if (typeof g.packed !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(g.packed)) return badIn(file)(p + '/packed', 'base64 bytes');
            const kept: Block = { sub: SUB_LZSS, decomp: payload.length, data: unb64(g.packed) };
            let unpacked: Uint8Array | null = null;
            try { unpacked = unpackBlock(kept); } catch { /* stale: compress anew */ }
            if (unpacked && unpacked.length === payload.length && unpacked.every((x, i) => x === payload[i])) return kept;
            report({ level: 'info', code: 'repacked', file, pointer: p + '/packed', message: 'the packed bytes no longer give this data; compressed anew' });
        }
        return { sub: SUB_LZSS, decomp: payload.length, data: lzssCompressVanilla(payload) };
    };
    const v = f.map, meta = f.metatiles, obj = f.objects;
    if (v?.format !== FORMAT || v.version !== TREE_MAP_VERSION) return bad('/format', `"${FORMAT}", version ${TREE_MAP_VERSION}`, 'schema');
    if (meta?.format !== META_FORMAT || meta.version !== 1) return badMeta('/format', `"${META_FORMAT}", version 1`, 'schema');
    if (obj?.format !== OBJ_FORMAT || obj.version !== 1) return badObj('/format', `"${OBJ_FORMAT}", version 1`, 'schema');

    const pair = (a: unknown) => Array.isArray(a) && a.length === 2 && a.every(isByte);
    const triggers = (list: any, p: string): TriggerRecord[] | null => {
        if (!Array.isArray(list)) return bad(p, 'a list of { from: [x, y], to: [x, y], script }');
        const out: TriggerRecord[] = [];
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            if (!t || !pair(t.from) || !pair(t.to)) return bad(`${p}/${i}`, 'from and to: [x, y], bytes');
            if (!isWord(t.script)) return bad(`${p}/${i}/script`, 'a script id (word)');
            out.push({ x1: t.from[0], y1: t.from[1], x2: t.to[0], y2: t.to[1], scriptId: t.script });
        }
        return out;
    };
    const familyIds = (list: unknown, p: string): number[] | null => {
        if (!Array.isArray(list) || list.length > 0xFF) return bad(p, 'a list of tile family names');
        const out: number[] = [];
        for (let i = 0; i < list.length; i++) {
            const id = refs.family(list[i]);
            if (id === undefined) return bad(`${p}/${i}`, `no tile family "${list[i]}"`, 'unknown-reference');
            out.push(id);
        }
        return out;
    };
    const tileId = (name: unknown, p: string, dma: boolean): number | null => {
        const id = typeof name === 'string' ? refs.tile(name, dma) : undefined;
        return id === undefined ? bad(p, `no tile "${name}"`, 'unknown-reference') : id;
    };
    const animations = (list: any, p: string): Channel[] | null => {
        if (!Array.isArray(list) || list.length > MAX_CHANNELS) return bad(p, `at most ${MAX_CHANNELS} channels of { countdown, frames: [{ ticks, tile }, …] }`);
        const out: Channel[] = [];
        for (let c = 0; c < list.length; c++) {
            const ch = list[c];
            if (!ch || !isByte(ch.countdown) || !Array.isArray(ch.frames) || ch.frames.length > 0xFF) return bad(`${p}/${c}`, '{ countdown: byte, frames: at most 255 }');
            const frames = [];
            for (let k = 0; k < ch.frames.length; k++) {
                const fr = ch.frames[k];
                if (!fr || !isByte(fr.ticks)) return bad(`${p}/${c}/frames/${k}/ticks`, 'a byte (60 Hz frames)');
                const tile = tileId(fr.tile, `${p}/${c}/frames/${k}/tile`, true);
                if (tile === null) return null;
                frames.push({ ticks: fr.ticks, tile });
            }
            out.push({ countdown: ch.countdown, frames });
        }
        return out;
    };

    // map.json
    const hd = v.header;
    const header = (() => {
        if (!hd || !pair(hd.triggerOrigin)) return bad('/header/triggerOrigin', '[x, y], bytes');
        for (const k of ['mainScreen', 'subScreen', 'colourMath', 'colourWindow', 'effect']) if (!isByte(hd[k])) return bad(`/header/${k}`, 'a byte');
        for (const k of ['cameraFlags', 'reserved']) if (!isWord(hd[k])) return bad(`/header/${k}`, 'a word');
        return [hd.triggerOrigin[0], hd.triggerOrigin[1], 0, 0, hd.mainScreen, hd.subScreen, hd.colourMath, hd.colourWindow, hd.effect,
            hd.cameraFlags & 0xFF, hd.cameraFlags >> 8, hd.reserved & 0xFF, hd.reserved >> 8];
    })();
    const extras = (() => {
        if (!Array.isArray(v.paletteCycles)) return bad('/paletteCycles', 'a list of { start, colours, rate }');
        const out: number[] = [];
        for (let i = 0; i < v.paletteCycles.length; i++) {
            const c = v.paletteCycles[i];
            if (!c || !isByte(c.start) || !isByte(c.colours) || !Number.isInteger(c.rate) || c.rate < -128 || c.rate > 127) return bad(`/paletteCycles/${i}`, 'start, colours: bytes; rate: -128..127');
            out.push(c.start, c.colours, c.rate & 0xFF);
        }
        return Uint8Array.from(out);
    })();
    const g = v.graphics;
    if (!g || !Array.isArray(g.tiles)) return bad('/graphics', '{ compression, tiles: [tile name, …], packed?: base64 }');
    const ids: number[] = [];
    for (let i = 0; i < g.tiles.length; i++) { const id = tileId(g.tiles[i], `/graphics/tiles/${i}`, false); if (id === null) return null; ids.push(id); }
    const block1 = pack(graphicPayload(ids), g, '/graphics', TREE_MAP.map);
    const anim = animations(v.animations, '/animations');

    // grid.txt
    if (typeof f.grid !== 'string') return badGrid('', 'missing', 'missing-file');
    const rows = f.grid.split('\n').filter((l, i, all) => l.trim() !== '' || i < all.length - 1);
    const width = rows.length ? rows[0].trim().split(/\s+/).length : 0;
    const cells: number[] = [];
    for (let y = 0; y < rows.length; y++) {
        const tokens = rows[y].trim().split(/\s+/);
        if (tokens.length !== width) return badGrid(`/${y}`, `${tokens.length} cells; the first row has ${width}`);
        for (let x = 0; x < width; x++) {
            if (!/^[0-9a-f]{1,4}$/.test(tokens[x])) return badGrid(`/${y}/${x}`, `"${tokens[x]}": a metatile id in hex`);
            cells.push(parseInt(tokens[x], 16));
        }
    }
    if (!width || width > 0xFF || rows.length > 0xFF) return badGrid('', `${width}×${rows.length} cells; 1-255 each way`);

    // metatiles.json
    if (!Array.isArray(meta.list)) return badMeta('/list', 'a list of { id, canopy, terrain, collision }');
    const slots = slotNames(g.tiles), channelCount = anim ? anim.length : 0;
    const n = meta.list.length, payload = new Uint8Array(n * 6);
    for (let k = 0; k < n; k++) {
        const t = meta.list[k];
        if (t?.id !== undefined && parseInt(t.id, 16) !== k) return badMeta(`/list/${k}/id`, `"${t.id}" is entry ${k} (${hexN(k, 3)}): ids are positions, in order`);
        const parts = [parseLayer(t?.canopy, slots, channelCount), parseLayer(t?.terrain, slots, channelCount), parseCollision(t?.collision)];
        for (let slice = 0; slice < 3; slice++) {
            const w = parts[slice];
            if (typeof w === 'string') return badMeta(`/list/${k}/${['canopy', 'terrain', 'collision'][slice]}`, w);
            payload[(slice * n + k) * 2] = w & 0xFF; payload[(slice * n + k) * 2 + 1] = w >> 8;
        }
    }
    const over = cells.findIndex(c => c >= n);
    if (over >= 0) return badGrid(`/${Math.floor(over / width)}/${over % width}`, `metatile ${hexN(cells[over], 3)}; metatiles.json has ${n}`);
    const block3 = pack(payload, meta, '', TREE_MAP.metatiles);

    // cuttable grass (map.json) and objects.json, in metatile indices over the grid
    const room: Cells = { width, height: rows.length, cells, base: 2 * width * rows.length, count: n };
    const section4 = parseGrass(v.cuttableGrass, v.grassSources, room.base, n);
    if (!(section4 instanceof Uint8Array)) return bad(section4.pointer, section4.message);
    const objects = parseObjects(obj.list, room);
    if ('pointer' in objects) return badObj(objects.pointer, objects.message);

    if (!header || !extras || !block1 || !anim || !block3) return null;
    const hdr = Uint8Array.from(header);
    hdr[2] = width; hdr[3] = rows.length;
    let block2: Block;
    try { block2 = encodeBlock2(cells.map(c => room.base + 8 * c), width, rows.length, room.base, section4[0]); }
    catch (e) { return badGrid('', (e as Error).message); }
    const stepOn = triggers(v.stepOn, '/stepOn'), bTrigger = triggers(v.bTrigger, '/bTrigger'), tileFamilies = familyIds(v.tileFamilies, '/tileFamilies');
    if (!stepOn || !bTrigger || !tileFamilies) return null;
    return {
        header: hdr, stepOn, bTrigger, tileFamilies, extras, block1, section2Count: anim.length, section2Data: section2Bytes(anim),
        objectOffsets: objects.offsets, block2, section4, block3, objectArea: objects.area,
    };
}

/** The blob the files describe, or null (problems reported). */
export function blobFromTree(f: TreeMapFiles, refs: TreeRefs, report: (p: TreeProblem) => void): Uint8Array | null {
    const m = roomFromTree(f, refs, report);
    if (!m) return null;
    try { return buildBlob(m); }
    catch (e) { report({ level: 'error', code: 'invalid-value', file: TREE_MAP.map, pointer: '', message: (e as Error).message }); return null; }
}
