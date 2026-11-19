// The `maps` kind (docs/open-evermore/resources.md §maps): every room as a folder maps/<name>/ (map.json: header,
// families, graphics, animations, triggers, objects; grid.txt: the cells; metatiles.json: what each metatile draws
// and how it collides; preview.png: the room drawn, for the reader only), reached only through the map table
// implode writes. Decoding and encoding are the repo's own (`modelFromRom` / `buildBlob`); this file names, writes
// text and checks. Explode proves every room comes back from its files byte for byte.
//
// Facts used (docs/map-format/room-reference.md, docs/table-hack.md §1):
//   map table   127 entries × [24-bit pointer, pad 0], read by $90:8F69 / $90:8F6F; implode rewrites it in place,
//               in the order of maps/_enum.json
//   pointer     bus form $80-$BF:8000+ (= 0x800000 | file offset of an upper half)
//   blob        upper half of a bank, never across a bank, at most 32 KiB
//   blocks      stored uncompressed, with the compression they get (owner, 2026-11-19): `lzssCompressVanilla` gives
//               back 237 of the 241 vanilla LZSS blocks and the Markov encoder all 127 grids; for the other four
//               `packed` keeps the vanilla bytes while they still unpack to the data
//   graphics    Block 1: 16-bit deltas summed into tile ids (LZSS in 115 rooms, raw in 12)
//   grid        Block 2: the Markov-coded cell grid, always Markov (room.ts requires it); grid.txt holds metatile
//               indices in hex, one row per line, and gives header bytes 2-3 (width, height); ids are base + 8·index
//               with base = 2·width·height; the context count is Section 4's first byte
//   metatiles   Block 3: three slices of words, canopy, terrain, collision; metatiles.json, one metatile per line
//   animations  Section 2: [count][len:2], count × [countdown, frames, offset:2], 0xFF (also with no channel),
//               frames × [ticks, tile:2];
//               canonical (offsets ascend, each channel's frames follow the last), so it is rebuilt from the list
// References to exploded kinds are names (tileFamilies → tile_families/, graphics and animation frames →
// tiles/); the ids of kinds not exploded yet (script ids) stay numbers until their kinds are.
import { createRequire } from 'node:module';
import { mark } from '../../codec.mts';
import type { Codec, ImplodeContext, Item, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { Findings } from '../../findings.mts';
import { json, NAME_RE, readText, sha1, withoutKeys } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');
const blocks = require('../../../../dist/games/evermore/maps/encode');
const markov = require('../../../../dist/games/evermore/maps/markov');
const ROOMS: { id: number; path: string }[] = require('../../../../src/games/evermore/localizations/data/rooms.json');

const DIR = 'maps', FILE = 'map.json', GRID = 'grid.txt', META = 'metatiles.json', PREVIEW = 'preview.png';
const STRIDE = 4, COUNT = 127, MAX_BLOB = 0x8000;
const FORMAT = 'open-evermore/map', VERSION = 5, META_FORMAT = 'open-evermore/metatiles';
const FAMILIES = 'tile_families', TILES = 'tiles';
/** Animation channels the engine runs ($90:A1B4 scans 50). */
const MAX_CHANNELS = 50;

interface Block { sub: number; decomp: number; data: Uint8Array }
interface Trigger { y1: number; x1: number; y2: number; x2: number; scriptId: number }
interface RoomModel {
    header: Uint8Array; stepOn: Trigger[]; bTrigger: Trigger[]; tileFamilies: number[]; extras: Uint8Array;
    block1: Block; section2Count: number; section2Data: Uint8Array; objectOffsets: number[]; block2: Block;
    section4: Uint8Array; block3: Block; objectArea: Uint8Array;
}

/** Our own room names (data/rooms.json `path`, D4), as snake case. */
export function mapName(id: number): string {
    const room = ROOMS.find(r => r.id === id);
    return room ? room.path.replace(/[/-]/g, '_').replace(/[^a-z0-9_]/g, '') : 'map_' + id.toString(16).padStart(2, '0');
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');
const hexN = (v: number, n: number) => v.toString(16).padStart(n, '0');
/** How a payload is stored: our compressor's choice, plus the vanilla bytes only where it does not reproduce them. */
function stored(b: Block, payload: Uint8Array): { compression: string; packed?: string } {
    if (b.sub === blocks.SUB_RAW) return { compression: 'none' };
    const ours: Uint8Array = blocks.lzssCompressVanilla(payload);
    return ours.length === b.data.length && ours.every((x, i) => x === b.data[i]) ? { compression: 'lzss' } : { compression: 'lzss', packed: b64(b.data) };
}
const fc4Of = (section4: Uint8Array) => section4.length ? section4[0] : 0;
const wordsOf = (raw: Uint8Array) => Array.from({ length: raw.length >> 1 }, (_, i) => raw[i * 2] | (raw[i * 2 + 1] << 8));

interface Channel { countdown: number; frames: { ticks: number; tile: number }[] }

/** Block 1's payload → tile ids (the engine sums the deltas at $90:8E85), and back. */
function graphicIds(b: Block): number[] {
    const raw: Uint8Array = blocks.unpackBlock(b), ids: number[] = [];
    let acc = 0;
    for (let i = 0; i + 1 < raw.length; i += 2) ids.push(acc = (acc + (raw[i] | (raw[i + 1] << 8))) & 0xFFFF);
    return ids;
}
const graphicPayload = (ids: number[]) => blocks.unpackBlock(blocks.encodeBlock1(ids, false)) as Uint8Array;

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

// ── A metatile word as text (room-reference.md §3, §9) ─────────────────────────────────────────────────────────
// Layer word: "<graphic> p<palette>[ pr][ h][ v]", the graphic being a name of the room's graphics list ("#2" for
// its second occurrence), "anim<n>" for animation channel n's slot, or "chr<3 hex>" for a character no slot names
// (82 vanilla words use $3F0-$3FF). Collision word: "g<geometry>" then the set flags, in this order:
// "z<plane>" (bits 5-4), "see" (6), "bit7", "gate<n>" (11-8), "front" (12), "walk" (13), "step" (14), "b" (15).

/** The name each graphics slot answers to, and back. */
function slotNames(tiles: string[]): string[] {
    const seen = new Map<string, number>();
    return tiles.map(t => { const k = (seen.get(t) ?? 0) + 1; seen.set(t, k); return k === 1 ? t : `${t}#${k}`; });
}
function layerText(w: number, slots: string[], channelCount: number): string {
    const chr = w & 0x3FF, slot = maps.wordSlot(w);
    let ref = `chr${hexN(chr, 3)}`;
    if (chr < 0x3F0 && maps.tileSlotChr(slot) === chr) {
        if (slot < slots.length) ref = slots[slot];
        else if (slot - slots.length < channelCount) ref = `anim${slot - slots.length}`;
    }
    return [ref, `p${(w >> 10) & 7}`, ...(w & 0x2000 ? ['pr'] : []), ...(w & 0x4000 ? ['h'] : []), ...(w & 0x8000 ? ['v'] : [])].join(' ');
}
function parseLayer(s: unknown, slots: string[], channelCount: number): number | string {
    if (typeof s !== 'string') return 'a string: "<graphic> p<palette> [pr] [h] [v]"';
    const [ref, ...flags] = s.trim().split(/\s+/);
    let chr: number;
    const anim = /^anim(\d+)$/.exec(ref), raw = /^chr([0-9a-f]{3})$/.exec(ref);
    if (raw) chr = parseInt(raw[1], 16) & 0x3FF;
    else if (anim) {
        if (+anim[1] >= channelCount) return `"${ref}": the room has ${channelCount} animation channels`;
        chr = maps.tileSlotChr(slots.length + +anim[1]);
    } else {
        const slot = slots.indexOf(ref);
        if (slot < 0) return `"${ref}" is not in the room's graphics list`;
        chr = maps.tileSlotChr(slot);
    }
    let w = chr, pal = -1;
    for (const f of flags) {
        const p = /^p([0-7])$/.exec(f);
        if (p) pal = +p[1];
        else if (f === 'pr') w |= 0x2000;
        else if (f === 'h') w |= 0x4000;
        else if (f === 'v') w |= 0x8000;
        else return `"${f}": p0-p7, pr, h, v`;
    }
    if (pal < 0) return 'no palette (p0-p7)';
    return w | (pal << 10);
}
const FLAGS: [string, number][] = [['see', 0x40], ['bit7', 0x80], ['front', 0x1000], ['walk', 0x2000], ['step', 0x4000], ['b', 0x8000]];
function collisionText(c: number): string {
    const out = [`g${(c & 15).toString(16)}`];
    if (c & 0x30) out.push(`z${(c >> 4) & 3}`);
    if (c & 0x40) out.push('see');
    if (c & 0x80) out.push('bit7');
    if (c & 0xF00) out.push(`gate${((c >> 8) & 15).toString(16)}`);
    for (const [name, bit] of FLAGS.slice(2)) if (c & bit) out.push(name);
    return out.join(' ');
}
function parseCollision(s: unknown): number | string {
    if (typeof s !== 'string') return 'a string: "g<geometry> [z<plane>] [see] [gate<n>] [front] [walk] [step] [b]"';
    let c = 0, geometry = false;
    for (const f of s.trim().split(/\s+/)) {
        const g = /^g([0-9a-f])$/.exec(f), z = /^z([0-3])$/.exec(f), gate = /^gate([0-9a-f])$/.exec(f), flag = FLAGS.find(x => x[0] === f);
        if (g) { c |= parseInt(g[1], 16); geometry = true; }
        else if (z) c |= +z[1] << 4;
        else if (gate) c |= parseInt(gate[1], 16) << 8;
        else if (flag) c |= flag[1];
        else return `"${f}": g0-gf, z0-z3, see, bit7, gate0-gatef, front, walk, step, b`;
    }
    return geometry ? c : 'no geometry (g0-gf)';
}

/** The three files of a room (map.json, grid.txt, metatiles.json); `preview.png` comes from explode. */
function toFiles(m: RoomModel, family: (id: number) => string, tile: (id: number) => string): Map<string, Uint8Array> {
    const h = m.header, ids = graphicIds(m.block1), anim = channels(m.section2Count, m.section2Data);
    const slots = slotNames(ids.map(tile));
    const trigger = (t: Trigger) => ({ from: [t.x1, t.y1], to: [t.x2, t.y2], script: t.scriptId });
    const cycles = [];
    for (let i = 0; i + 2 < m.extras.length; i += 3) cycles.push({ start: m.extras[i], colours: m.extras[i + 1], rate: (m.extras[i + 2] << 24) >> 24 });
    const map = {
        format: FORMAT, version: VERSION,
        header: {
            triggerOrigin: [h[0], h[1]], mainScreen: h[4], subScreen: h[5], colourMath: h[6], colourWindow: h[7], effect: h[8],
            cameraFlags: h[9] | (h[10] << 8), reserved: h[11] | (h[12] << 8),
        },
        tileFamilies: m.tileFamilies.map(family),
        paletteCycles: cycles,
        graphics: { ...stored(m.block1, blocks.unpackBlock(m.block1)), tiles: ids.map(tile) },
        animations: anim.map(c => ({ countdown: c.countdown, frames: c.frames.map(f => ({ ticks: f.ticks, tile: tile(f.tile) })) })),
        stepOn: m.stepOn.map(trigger),
        bTrigger: m.bTrigger.map(trigger),
        cuttableGrass: b64(m.section4),
        objects: { offsets: m.objectOffsets, data: b64(m.objectArea) },
    };
    const w = h[2], hh = h[3], base = 2 * w * hh;
    const cells: number[] = markov.decompressMarkovGrid(m.block2.data, 0, w, hh, base, fc4Of(m.section4)).map((id: number) => (id - base) / 8);
    const digits = Math.max(3, Math.max(0, ...cells).toString(16).length);
    const grid = Array.from({ length: hh }, (_, y) => cells.slice(y * w, y * w + w).map(c => hexN(c, digits)).join(' ')).join('\n') + '\n';
    const words = wordsOf(blocks.unpackBlock(m.block3)), n = words.length / 3;
    const metatiles = {
        format: META_FORMAT, version: 1, ...stored(m.block3, blocks.unpackBlock(m.block3)),
        list: Array.from({ length: n }, (_, k) => ({
            id: hexN(k, digits), canopy: layerText(words[k], slots, anim.length), terrain: layerText(words[n + k], slots, anim.length), collision: collisionText(words[2 * n + k]),
        })),
    };
    return new Map([[FILE, json(map)], [GRID, new TextEncoder().encode(grid)], [META, json(metatiles)]]);
}

/** A room's files → model; every problem is a finding with its file and JSON pointer (grid.txt: /row/column). */
function fromFiles(files: Map<string, Uint8Array | undefined>, dir: string, ctx: ImplodeContext): RoomModel | null {
    const file = `${dir}/${FILE}`, gridFile = `${dir}/${GRID}`, metaFile = `${dir}/${META}`;
    const badIn = (f: string) => (pointer: string, msg: string) => { ctx.findings.error('invalid-value', f, pointer, msg); return null; };
    const bad = badIn(file), badMeta = badIn(metaFile), badGrid = badIn(gridFile);
    const isByte = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 0xFF;
    const isWord = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 0xFFFF;
    const bytesB64 = (s: unknown, p: string, f = bad) => typeof s === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(s) ? new Uint8Array(Buffer.from(s, 'base64')) : f(p, 'base64 bytes');
    const parse = (f: string): any => {
        const b = files.get(f.slice(dir.length + 1));
        if (!b) { ctx.findings.error('missing-file', f, '', 'a map folder holds map.json, grid.txt and metatiles.json'); return null; }
        try { return JSON.parse(readText(b)); } catch (e) { ctx.findings.error('parse-error', f, '', (e as Error).message); return null; }
    };
    /** A payload under its noted compression: the kept vanilla bytes while they still unpack to it, else ours. */
    const pack = (payload: Uint8Array, g: any, p: string, f: string): Block | null => {
        if (g.compression === 'none') return { sub: blocks.SUB_RAW, decomp: payload.length, data: payload };
        if (g.compression !== 'lzss') return badIn(f)(p + '/compression', '"lzss" or "none"');
        if (g.packed !== undefined) {
            const packed = bytesB64(g.packed, p + '/packed', badIn(f));
            if (!packed) return null;
            const kept: Block = { sub: blocks.SUB_LZSS, decomp: payload.length, data: packed };
            let unpacked: Uint8Array | null = null;
            try { unpacked = blocks.unpackBlock(kept); } catch { /* stale: compress anew */ }
            if (unpacked && unpacked.length === payload.length && unpacked.every((x, i) => x === payload[i])) return kept;
            ctx.findings.info('repacked', f, p + '/packed', 'the packed bytes no longer give this data; compressed anew');
        }
        return { sub: blocks.SUB_LZSS, decomp: payload.length, data: blocks.lzssCompressVanilla(payload) };
    };
    const v = parse(file), meta = parse(metaFile);
    const gridBytes = files.get(GRID);
    if (!gridBytes) ctx.findings.error('missing-file', gridFile, '', 'a map folder holds map.json, grid.txt and metatiles.json');
    if (!v || !meta || !gridBytes) return null;
    if (v.format !== FORMAT || v.version !== VERSION) { ctx.findings.error('schema', file, '/format', `"${FORMAT}", version ${VERSION}`); return null; }
    if (meta.format !== META_FORMAT || meta.version !== 1) { ctx.findings.error('schema', metaFile, '/format', `"${META_FORMAT}", version 1`); return null; }

    const pair = (a: unknown) => Array.isArray(a) && a.length === 2 && a.every(isByte);
    const triggers = (list: any, p: string): Trigger[] | null => {
        if (!Array.isArray(list)) return bad(p, 'a list of { from: [x, y], to: [x, y], script }');
        const out: Trigger[] = [];
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            if (!t || !pair(t.from) || !pair(t.to)) return bad(`${p}/${i}`, 'from and to: [x, y], bytes');
            if (!isWord(t.script)) return bad(`${p}/${i}/script`, 'a script id (word)');
            out.push({ x1: t.from[0], y1: t.from[1], x2: t.to[0], y2: t.to[1], scriptId: t.script });
        }
        return out;
    };
    const families = ctx.ids.get(FAMILIES) ?? new Map<string, number>();
    const familyIds = (list: unknown, p: string): number[] | null => {
        if (!Array.isArray(list) || list.length > 0xFF) return bad(p, 'a list of tile family names');
        const out: number[] = [];
        for (let i = 0; i < list.length; i++) {
            const id = families.get(list[i]);
            if (id === undefined) { ctx.findings.error('unknown-reference', file, `${p}/${i}`, `no tile family "${list[i]}" in ${FAMILIES}/`); return null; }
            out.push(id);
        }
        return out;
    };
    const tiles = ctx.ids.get(TILES) ?? new Map<string, number>();
    const tileId = (n: unknown, p: string, dma: boolean): number | null => {
        const id = tiles.get(n as string);
        if (id === undefined) { ctx.findings.error('unknown-reference', file, p, `no tile "${n}" in ${TILES}/`); return null; }
        mark(ctx, `${TILES}/${n}`, 'used');
        if (dma) mark(ctx, `${TILES}/${n}`, 'dma');
        return id;
    };
    const animations = (list: any, p: string): Channel[] | null => {
        if (!Array.isArray(list) || list.length > MAX_CHANNELS) return bad(p, `at most ${MAX_CHANNELS} channels of { countdown, frames: [{ ticks, tile }, …] }`);
        const out: Channel[] = [];
        for (let c = 0; c < list.length; c++) {
            const ch = list[c];
            if (!ch || !isByte(ch.countdown) || !Array.isArray(ch.frames) || ch.frames.length > 0xFF) return bad(`${p}/${c}`, '{ countdown: byte, frames: at most 255 }');
            const frames = [];
            for (let k = 0; k < ch.frames.length; k++) {
                const f = ch.frames[k];
                if (!f || !isByte(f.ticks)) return bad(`${p}/${c}/frames/${k}/ticks`, 'a byte (60 Hz frames)');
                const tile = tileId(f.tile, `${p}/${c}/frames/${k}/tile`, true);
                if (tile === null) return null;
                frames.push({ ticks: f.ticks, tile });
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
    const ids: number[] = [];
    if (!g || !Array.isArray(g.tiles)) return bad('/graphics', '{ compression, tiles: [tile name, …], packed?: base64 }');
    for (let i = 0; i < g.tiles.length; i++) { const id = tileId(g.tiles[i], `/graphics/tiles/${i}`, false); if (id === null) return null; ids.push(id); }
    const block1 = pack(graphicPayload(ids), g, '/graphics', file);
    const anim = animations(v.animations, '/animations');
    const section4 = bytesB64(v.cuttableGrass, '/cuttableGrass');
    const objects = v.objects;
    const offsets = objects && Array.isArray(objects.offsets) && objects.offsets.length <= 0xFF && objects.offsets.every(isWord) ? objects.offsets as number[] : bad('/objects/offsets', 'at most 255 words');
    const objectArea = bytesB64(objects?.data, '/objects/data');

    // grid.txt
    const rows = readText(gridBytes).split('\n').filter((l, i, all) => l.trim() !== '' || i < all.length - 1);
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
    const slots = slotNames(Array.isArray(g.tiles) ? g.tiles : []), channelCount = anim ? anim.length : 0;
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
    const bad2 = cells.findIndex(c => c >= n);
    if (bad2 >= 0) return badGrid(`/${Math.floor(bad2 / width)}/${bad2 % width}`, `metatile ${hexN(cells[bad2], 3)}; metatiles.json has ${n}`);
    const block3 = pack(payload, meta, '', metaFile);

    if (!header || !extras || !block1 || !anim || !section4 || !offsets || !objectArea || !block3) return null;
    const hdr = Uint8Array.from(header);
    hdr[2] = width; hdr[3] = rows.length;
    const base = 2 * width * rows.length;
    let block2: Block;
    try { block2 = blocks.encodeBlock2(cells.map(c => base + 8 * c), width, rows.length, base, fc4Of(section4)); }
    catch (e) { return badGrid('', (e as Error).message); }
    const m = {
        header: hdr, stepOn: triggers(v.stepOn, '/stepOn'), bTrigger: triggers(v.bTrigger, '/bTrigger'),
        tileFamilies: familyIds(v.tileFamilies, '/tileFamilies'), extras, block1, section2Count: anim.length,
        section2Data: section2Bytes(anim), objectOffsets: offsets, block2, section4, block3, objectArea,
    };
    return Object.values(m).some(x => x === null) ? null : m as RoomModel;
}

/** The blob a room's files implode to, ids taken from `ids`: explode's own check. */
function lossless(files: Map<string, Uint8Array>, ids: Map<string, Map<string, number>>): Uint8Array {
    const findings = new Findings();
    const model = fromFiles(files, 'explode', { ids, findings, marks: new Map() } as unknown as ImplodeContext);
    if (!model) throw new Error('explode wrote room files it cannot read: ' + findings.list.map(f => `${f.file}#${f.pointer} ${f.message}`).join('; '));
    return maps.buildBlob(model);
}

export const mapsCodec: Codec = {
    kind: 'maps', version: 5, path: DIR,
    // preview.png shows the room; nothing reads it back.
    canonical(path, bytes) {
        if (path.endsWith('/' + PREVIEW)) return null;
        // Hand-written text may order flags or pad numbers differently: compare what it means.
        if (path.endsWith('/' + GRID)) return [path, json(readText(bytes).trim().split('\n').map(r => r.trim().split(/\s+/).map(t => parseInt(t, 16))))];
        if (path.endsWith('/' + META)) {
            const v = JSON.parse(readText(withoutKeys(path, bytes, ['packed', 'id'])));
            const norm = (t: unknown) => typeof t === 'string' ? t.trim().split(/\s+/).sort().join(' ') : t;
            for (const e of v.list ?? []) for (const k of ['canopy', 'terrain', 'collision']) e[k] = norm(e[k]);
            return [path, json(v)];
        }
        return [path, withoutKeys(path, bytes, ['packed'])];
    },

    defaultName: mapName,

    explode(rom, name) {
        const files: Tree = new Map();
        const table = maps.mapTableOffset(rom);
        const names: string[] = [];
        const pool = [], homes = [];
        const ids = new Map<string, Map<string, number>>();
        const by = (kind: string, count: number) => new Map(Array.from({ length: count }, (_, id) => [name(kind, id), id] as [string, number]));
        ids.set(FAMILIES, by(FAMILIES, 1024));
        ids.set(TILES, by(TILES, 0x10000 / 3 | 0));
        for (let id = 0; id < COUNT; id++) {
            const at = maps.roomBlobOffset(rom, id);
            const end = maps.objectAreaEnd(rom, maps.parseBlobLayout(rom, at));
            const model = maps.modelFromRom(rom, id);
            const n = name('maps', id);
            names.push(n);
            const room = toFiles(model, f => name(FAMILIES, f), t => name(TILES, t));
            if (sha1(lossless(room, ids)) !== sha1(rom.subarray(at, end))) throw new Error(`room ${id}: its files do not give its bytes back; explode would lose data`);
            for (const [f, bytes] of room) files.set(`${DIR}/${n}/${f}`, bytes);
            files.set(`${DIR}/${n}/${PREVIEW}`, new Uint8Array(maps.encodePng(maps.renderRoomComposite(rom, maps.decodeRoom(rom, id)))));
            const blob = rom.subarray(at, end);
            pool.push({ start: at, end });
            homes.push({ key: `${DIR}/${n}`, at, length: blob.length, sha1: sha1(blob) });
        }
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: 'maps', limit: COUNT, names,
            why: `the map table holds ${COUNT} entries and stays where it is for now (engine limit: 256, the enter-script multiply)`,
        }));
        return { files, pool, tables: [{ start: table, end: table + COUNT * STRIDE }], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const [, name, file, more] = path.split('/');
            if (file !== undefined && more === undefined && [FILE, GRID, META, PREVIEW].includes(file)) names.add(name);
            else findings.warning('unknown-file', path, '', `a map folder holds ${FILE}, ${GRID}, ${META} and ${PREVIEW}; ignored`);
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx;
        const items: Item[] = [];
        for (const name of names) {
            const dir = `${DIR}/${name}`, file = `${dir}/${FILE}`;
            if (!NAME_RE.test(name)) { findings.error('bad-name', file, '', `"${name}": snake_case, at most 80 characters`); continue; }
            const model = fromFiles(new Map([FILE, GRID, META].map(f => [f, tree.get(`${dir}/${f}`)])), dir, ctx);
            if (!model) continue;
            let bytes: Uint8Array;
            try { bytes = maps.buildBlob(model); }
            catch (e) { findings.error('invalid-value', file, '', (e as Error).message); continue; }
            if (bytes.length > MAX_BLOB) { findings.error('over-budget', file, '', `blob of ${bytes.length} bytes; a room is at most ${MAX_BLOB}`); continue; }
            items.push({ key: `${DIR}/${name}`, file, bytes, rule: { upperHalf: true, noCrossBank: true, maxSize: MAX_BLOB } });
        }
        return items;
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get('maps');
        const span = ctx.base.tables.find(t => t.kind === 'maps');
        if (!ids || !span) return [];
        const byId = new Map([...ids].map(([name, id]) => [id, name]));
        const bytes = new Uint8Array(COUNT * STRIDE);
        for (let id = 0; id < COUNT; id++) {
            const name = byId.get(id);
            if (name === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no map has id ${id}; the map table cannot skip one yet`); continue; }
            const at = placed.get(`${DIR}/${name}`);
            if (at === undefined) continue;
            const bus = 0x800000 | at;
            bytes.set([bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16, 0], id * STRIDE);
        }
        const write: Write = { at: span.start, bytes, file: `${DIR}/${ENUM}` };
        return [write];
    },
};
