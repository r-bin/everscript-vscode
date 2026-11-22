// Ownership: a room as the files of an Open Evermore tree (docs/open-evermore/resources.md §maps) and back, one
// concern per file: map.json (header, palettes, graphics), scripts.json (the scripts the room runs: its enter script,
// its step-on and B triggers), animations.json (animated tiles, palette cycles), grass.json (cuttable grass),
// grid.txt (the cells), metatiles.json (what each metatile draws and how it collides) and objects.json (each object's
// states). Pure: values in, values out; the tool (tools/open-evermore) and the Rooms tab (imports/tree/) do the files.
// Every byte of a vanilla room comes back (explode checks it); references to other kinds are names, and every entry
// a reader may point at (a trigger, an object) has a name of its own.
//
// Facts used (room-reference.md):
//   graphics    Block 1: 16-bit deltas summed into tile ids ($90:8E85)
//   grid        Block 2, always Markov; ids are base + 8·index with base = 2·width·height; the first counter is
//               Section 4's first byte
//   metatiles   Block 3: three slices of words, front (BG1), back (BG2), collision
//   animations  Section 2: [count][len:2], count × [countdown, frames, offset:2], 0xFF, frames × [ticks, tile:2];
//               canonical (offsets ascend, each channel's frames follow the last), so it is rebuilt from the list
//   compression noted, not stored: our `lzssCompressVanilla` gives back 237 of the 241 vanilla LZSS blocks; the
//               other four carry `packed` (their vanilla bytes) while those still unpack to the data

import { buildBlob, encodeBlock1, encodeBlock2, lzssCompressVanilla, unpackBlock, SUB_LZSS, SUB_RAW } from './encode';
import type { Block, RoomModel, TriggerRecord } from './encode';
import { decompressMarkovGrid } from './markov';
import { COLLISION_FORMS, collisionFields, collisionOfFields, grassText, hexN, layerFields, objectsText, paletteSlots, parseGrass, parseLayer, parseObjects, slotNames } from './tree-map-text';
import type { Cells } from './tree-map-text';

export const TREE_MAP = {
    map: 'map.json', scripts: 'scripts.json', animations: 'animations.json', grass: 'grass.json',
    grid: 'grid.txt', metatiles: 'metatiles.json', objects: 'objects.json',
} as const;
export type TreeMapFile = (typeof TREE_MAP)[keyof typeof TREE_MAP];
/** map.json's version; v7 moved triggers, animations and grass into files of their own, v8 calls tile families
 *  palettes (metatiles.json v2 names them in layer words, v3 writes a collision as its form, level and flags,
 *  v4 writes each layer as { tile, palette?, over?, flipH?, flipV? } under front / back, level only when not 1). */
export const TREE_MAP_VERSION = 8;
const FORMAT = 'open-evermore/map', META_FORMAT = 'open-evermore/metatiles', OBJ_FORMAT = 'open-evermore/objects';
const SCRIPTS_FORMAT = 'open-evermore/room-scripts', ANIM_FORMAT = 'open-evermore/room-animations', GRASS_FORMAT = 'open-evermore/grass';
/** The JSON files and the format each one names (grid.txt is text). */
const FORMATS: [keyof TreeMapFiles, string, number][] = [
    ['map', FORMAT, TREE_MAP_VERSION], ['scripts', SCRIPTS_FORMAT, 1], ['animations', ANIM_FORMAT, 1], ['grass', GRASS_FORMAT, 1],
    ['metatiles', META_FORMAT, 4], ['objects', OBJ_FORMAT, 1],
];
/** Animation channels the engine runs ($90:A1B4 scans 50). */
const MAX_CHANNELS = 50;

/** A room's files as values: JSON already parsed, grid.txt as text. */
export interface TreeMapFiles { map: any; scripts: any; animations: any; grass: any; grid: string; metatiles: any; objects: any }
/** Names for other kinds' ids (explode); `script`: a trigger's script id (a byte offset, 3·id) by name, when the
 *  tree has scripts (undefined keeps the number); `trigger` and `object`: the room's own entries by what they do
 *  (undefined: none written); `collision`: a collision form's name in the tree by code (undefined: COLLISION_FORMS'). */
export interface TreeNames {
    palette(id: number): string; tile(id: number): string; script?(scriptId: number): string | undefined; collision?(form: number): string | undefined;
    trigger?(list: 'stepOn' | 'bTrigger', index: number): string | undefined; object?(index: number): string | undefined;
}
/** Ids for other kinds' names (implode, the Rooms tab); `dma`: the tile is an animation frame (streamed raw);
 *  `script`: a trigger's script by name → its script id (3·id); `collision`: a collision form's code by its name in
 *  the tree (maps/collisions/; undefined: COLLISION_FORMS' names). */
export interface TreeRefs {
    palette(name: string): number | undefined; tile(name: string, dma: boolean): number | undefined; script?(name: string): number | undefined;
    collision?(name: string): number | undefined;
}
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
    const slots = slotNames(ids.map(names.tile)), palettes = m.tileFamilies.map(names.palette);
    const named = (n: string | undefined) => n === undefined ? {} : { name: n };
    const trigger = (list: 'stepOn' | 'bTrigger') => (t: TriggerRecord, i: number) =>
        ({ ...named(names.trigger?.(list, i)), from: [t.x1, t.y1], to: [t.x2, t.y2], script: names.script?.(t.scriptId) ?? t.scriptId });
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
        palettes,
        graphics: { ...stored(m.block1), tiles: ids.map(names.tile) },
    };
    const scripts = { format: SCRIPTS_FORMAT, version: 1, stepOn: m.stepOn.map(trigger('stepOn')), bTrigger: m.bTrigger.map(trigger('bTrigger')) };
    const animations = {
        format: ANIM_FORMAT, version: 1,
        tiles: anim.map(c => ({ countdown: c.countdown, frames: c.frames.map(f => ({ ticks: f.ticks, tile: names.tile(f.tile) })) })),
        paletteCycles: cycles,
    };
    const grassFile = { format: GRASS_FORMAT, version: 1, list: grass.list, ...(grass.sources !== undefined ? { sources: grass.sources } : {}) };
    const grid = Array.from({ length: room.height }, (_, y) => room.cells.slice(y * room.width, (y + 1) * room.width).map(c => hexN(c, digits)).join(' ')).join('\n') + '\n';
    const metatiles = {
        format: META_FORMAT, version: 4, ...stored(m.block3),
        list: Array.from({ length: n }, (_, k) => ({
            id: hexN(k, digits), front: layerFields(words[k], slots, anim.length, paletteSlots(palettes)), back: layerFields(words[n + k], slots, anim.length, paletteSlots(palettes)),
            ...collisionFields(words[2 * n + k], code => names.collision?.(code) ?? COLLISION_FORMS[code]),
        })),
    };
    const objects = { format: OBJ_FORMAT, version: 1, list: objectsText(m.objectOffsets, m.objectArea, room, digits).map((o, i) => {
        // A named object is reached by its name, so its place in the list is free; an unnamed one by its id.
        const n = names.object?.(i), { id, ...rest } = o;
        return n === undefined ? o : { name: n, ...rest };
    }) };
    return { map, scripts, animations, grass: grassFile, grid, metatiles, objects };
}

/** The room the files describe, or null; every problem goes to `report` with its file and JSON pointer (grid.txt: /row/column). */
export function roomFromTree(f: TreeMapFiles, refs: TreeRefs, report: (p: TreeProblem) => void): RoomModel | null {
    const badIn = (file: TreeMapFile) => (pointer: string, message: string, code = 'invalid-value') => { report({ level: 'error', code, file, pointer, message }); return null; };
    const bad = badIn(TREE_MAP.map), badMeta = badIn(TREE_MAP.metatiles), badGrid = badIn(TREE_MAP.grid), badObj = badIn(TREE_MAP.objects);
    const badScripts = badIn(TREE_MAP.scripts), badAnim = badIn(TREE_MAP.animations), badGrass = badIn(TREE_MAP.grass);
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
    const v = f.map, meta = f.metatiles, obj = f.objects, sc = f.scripts, an = f.animations, gr = f.grass;
    for (const [key, format, version] of FORMATS) {
        if (f[key]?.format !== format || f[key].version !== version) return badIn(TREE_MAP[key])('/format', `"${format}", version ${version}`, 'schema');
    }
    /** Names of a file's entries: optional, unique in the room's scripts.json (and in objects.json). */
    const namesOk = (lists: [any[], string][], badFile: (pointer: string, message: string, code?: string) => null): boolean => {
        const seen = new Set<string>();
        for (const [list, p] of lists) for (let i = 0; Array.isArray(list) && i < list.length; i++) {
            const n = list[i]?.name;
            if (n === undefined) continue;
            if (typeof n !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(n)) { badFile(`${p}/${i}/name`, 'snake_case, at most 80 characters'); return false; }
            if (seen.has(n)) { badFile(`${p}/${i}/name`, `"${n}" names two entries`, 'duplicate-name'); return false; }
            seen.add(n);
        }
        return true;
    };
    if (!namesOk([[sc.stepOn, '/stepOn'], [sc.bTrigger, '/bTrigger']], badScripts) || !namesOk([[obj.list, '/list']], badObj)) return null;

    const pair = (a: unknown) => Array.isArray(a) && a.length === 2 && a.every(isByte);
    const triggers = (list: any, p: string): TriggerRecord[] | null => {
        if (!Array.isArray(list)) return badScripts(p, 'a list of { name, from: [x, y], to: [x, y], script }');
        const out: TriggerRecord[] = [];
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            if (!t || !pair(t.from) || !pair(t.to)) return badScripts(`${p}/${i}`, 'from and to: [x, y], bytes');
            const id = typeof t.script === 'string' ? refs.script?.(t.script) : t.script;
            if (typeof t.script === 'string' && id === undefined) return badScripts(`${p}/${i}/script`, `no script "${t.script}"`, 'unknown-reference');
            if (!isWord(id)) return badScripts(`${p}/${i}/script`, 'a script by name, or a script id (word)');
            out.push({ x1: t.from[0], y1: t.from[1], x2: t.to[0], y2: t.to[1], scriptId: id as number });
        }
        return out;
    };
    const paletteIds = (list: unknown, p: string): number[] | null => {
        if (!Array.isArray(list) || list.length > 0xFF) return bad(p, 'a list of palette names');
        const out: number[] = [];
        for (let i = 0; i < list.length; i++) {
            const id = refs.palette(list[i]);
            if (id === undefined) return bad(`${p}/${i}`, `no palette "${list[i]}"`, 'unknown-reference');
            out.push(id);
        }
        return out;
    };
    const tileId = (name: unknown, p: string, dma: boolean, badFile = bad): number | null => {
        const id = typeof name === 'string' ? refs.tile(name, dma) : undefined;
        return id === undefined ? badFile(p, `no tile "${name}"`, 'unknown-reference') : id;
    };
    const animations = (list: any, p: string): Channel[] | null => {
        if (!Array.isArray(list) || list.length > MAX_CHANNELS) return badAnim(p, `at most ${MAX_CHANNELS} channels of { countdown, frames: [{ ticks, tile }, …] }`);
        const out: Channel[] = [];
        for (let c = 0; c < list.length; c++) {
            const ch = list[c];
            if (!ch || !isByte(ch.countdown) || !Array.isArray(ch.frames) || ch.frames.length > 0xFF) return badAnim(`${p}/${c}`, '{ countdown: byte, frames: at most 255 }');
            const frames = [];
            for (let k = 0; k < ch.frames.length; k++) {
                const fr = ch.frames[k];
                if (!fr || !isByte(fr.ticks)) return badAnim(`${p}/${c}/frames/${k}/ticks`, 'a byte (60 Hz frames)');
                const tile = tileId(fr.tile, `${p}/${c}/frames/${k}/tile`, true, badAnim);
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
        if (!Array.isArray(an.paletteCycles)) return badAnim('/paletteCycles', 'a list of { start, colours, rate }');
        const out: number[] = [];
        for (let i = 0; i < an.paletteCycles.length; i++) {
            const c = an.paletteCycles[i];
            if (!c || !isByte(c.start) || !isByte(c.colours) || !Number.isInteger(c.rate) || c.rate < -128 || c.rate > 127) return badAnim(`/paletteCycles/${i}`, 'start, colours: bytes; rate: -128..127');
            out.push(c.start, c.colours, c.rate & 0xFF);
        }
        return Uint8Array.from(out);
    })();
    // Before metatiles.json: its layer words name these palettes.
    const tileFamilies = paletteIds(v.palettes, '/palettes');
    if (!tileFamilies) return null;
    const g = v.graphics;
    if (!g || !Array.isArray(g.tiles)) return bad('/graphics', '{ compression, tiles: [tile name, …], packed?: base64 }');
    const ids: number[] = [];
    for (let i = 0; i < g.tiles.length; i++) { const id = tileId(g.tiles[i], `/graphics/tiles/${i}`, false); if (id === null) return null; ids.push(id); }
    const block1 = pack(graphicPayload(ids), g, '/graphics', TREE_MAP.map);
    const anim = animations(an.tiles, '/tiles');

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
    if (!Array.isArray(meta.list)) return badMeta('/list', 'a list of { id, front, back, collision, level?, … }');
    const slots = slotNames(g.tiles), channelCount = anim ? anim.length : 0, palettes = paletteSlots(v.palettes);
    const n = meta.list.length, payload = new Uint8Array(n * 6);
    for (let k = 0; k < n; k++) {
        const t = meta.list[k];
        if (t?.id !== undefined && parseInt(t.id, 16) !== k) return badMeta(`/list/${k}/id`, `"${t.id}" is entry ${k} (${hexN(k, 3)}): ids are positions, in order`);
        // The collision word from its fields; a form by the tree's name for it, else COLLISION_FORMS'.
        const formCode = (name: string) => { const c = refs.collision?.(name) ?? COLLISION_FORMS.indexOf(name); return c < 0 ? undefined : c; };
        const coll = collisionOfFields(t, formCode);
        const parts = [parseLayer(t?.front, slots, channelCount, palettes), parseLayer(t?.back, slots, channelCount, palettes), typeof coll === 'number' ? coll : coll.message];
        for (let slice = 0; slice < 3; slice++) {
            const w = parts[slice];
            if (typeof w === 'string') return badMeta(`/list/${k}/${slice < 2 ? ['front', 'back'][slice] : (coll as { field: string }).field}`, w);
            payload[(slice * n + k) * 2] = w & 0xFF; payload[(slice * n + k) * 2 + 1] = w >> 8;
        }
    }
    const over = cells.findIndex(c => c >= n);
    if (over >= 0) return badGrid(`/${Math.floor(over / width)}/${over % width}`, `metatile ${hexN(cells[over], 3)}; metatiles.json has ${n}`);
    const block3 = pack(payload, meta, '', TREE_MAP.metatiles);

    // grass.json and objects.json, in metatile indices over the grid
    const room: Cells = { width, height: rows.length, cells, base: 2 * width * rows.length, count: n };
    const section4 = parseGrass(gr.list, gr.sources, room.base, n);
    if (!(section4 instanceof Uint8Array)) return badGrass(section4.pointer, section4.message);
    const objects = parseObjects(obj.list, room);
    if ('pointer' in objects) return badObj(objects.pointer, objects.message);

    if (!header || !extras || !block1 || !anim || !block3) return null;
    const hdr = Uint8Array.from(header);
    hdr[2] = width; hdr[3] = rows.length;
    let block2: Block;
    try { block2 = encodeBlock2(cells.map(c => room.base + 8 * c), width, rows.length, room.base, section4[0]); }
    catch (e) { return badGrid('', (e as Error).message); }
    const stepOn = triggers(sc.stepOn, '/stepOn'), bTrigger = triggers(sc.bTrigger, '/bTrigger');
    if (!stepOn || !bTrigger) return null;
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
