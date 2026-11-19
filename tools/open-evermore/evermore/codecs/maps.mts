// The `maps` kind (docs/open-evermore/resources.md §maps): every room as maps/<name>/map.json, reached only through
// the map table implode writes. Decoding and encoding are the repo's own (`modelFromRom` / `buildBlob`, round trip
// of all 127 rooms); this file only names, serialises and checks.
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
//   grid        Block 2: the Markov-coded cell grid (header bytes 2-3 = width, height; ids base + 8·index with
//               base = 2·width·height; the context count is Section 4's first byte)
//   metatiles   Block 3: three slices of words, canopy, terrain, collision; one metatile per line
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
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');
const blocks = require('../../../../dist/games/evermore/maps/encode');
const markov = require('../../../../dist/games/evermore/maps/markov');
const ROOMS: { id: number; path: string }[] = require('../../../../src/games/evermore/localizations/data/rooms.json');

const DIR = 'maps', FILE = 'map.json';
const STRIDE = 4, COUNT = 127, MAX_BLOB = 0x8000;
const FORMAT = 'open-evermore/map', VERSION = 4;
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

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');
const word4 = (w: number) => w.toString(16).padStart(4, '0');
/** How a payload is stored: our compressor's choice, plus the vanilla bytes only where it does not reproduce them. */
function stored(b: Block, payload: Uint8Array): { compression: string; packed?: string } {
    if (b.sub === blocks.SUB_RAW) return { compression: 'none' };
    const ours: Uint8Array = blocks.lzssCompressVanilla(payload);
    return ours.length === b.data.length && ours.every((x, i) => x === b.data[i]) ? { compression: 'lzss' } : { compression: 'lzss', packed: b64(b.data) };
}
const fc4Of = (section4: Uint8Array) => section4.length ? section4[0] : 0;
function gridRows(m: RoomModel): number[][] {
    const w = m.header[2], h = m.header[3], base = 2 * w * h;
    const ids: number[] = markov.decompressMarkovGrid(m.block2.data, 0, w, h, base, fc4Of(m.section4));
    return Array.from({ length: h }, (_, y) => ids.slice(y * w, y * w + w).map(id => (id - base) / 8));
}
function metatileList(b: Block): string[][] {
    const raw: Uint8Array = blocks.unpackBlock(b), n = raw.length / 6, w = (i: number) => raw[i * 2] | (raw[i * 2 + 1] << 8);
    return Array.from({ length: n }, (_, k) => [word4(w(k)), word4(w(n + k)), word4(w(2 * n + k))]);
}
const trigger = (t: Trigger) => ({ area: [t.y1, t.x1, t.y2, t.x2], script: t.scriptId });

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

function toJson(m: RoomModel, family: (id: number) => string, tile: (id: number) => string): unknown {
    return {
        format: FORMAT, version: VERSION,
        header: hex(m.header),
        stepOn: m.stepOn.map(trigger),
        bTrigger: m.bTrigger.map(trigger),
        tileFamilies: m.tileFamilies.map(family),
        extras: hex(m.extras),
        graphics: { ...stored(m.block1, blocks.unpackBlock(m.block1)), tiles: graphicIds(m.block1).map(tile) },
        animations: channels(m.section2Count, m.section2Data).map(c => ({ countdown: c.countdown, frames: c.frames.map(f => ({ ticks: f.ticks, tile: tile(f.tile) })) })),
        objectOffsets: m.objectOffsets,
        grid: { compression: 'markov', rows: gridRows(m) },
        section4: b64(m.section4),
        metatiles: { ...stored(m.block3, blocks.unpackBlock(m.block3)), list: metatileList(m.block3) },
        objectArea: b64(m.objectArea),
    };
}

/** map.json → model; every problem is a finding with its JSON pointer. */
function fromJson(v: any, file: string, ctx: ImplodeContext): RoomModel | null {
    const bad = (pointer: string, msg: string) => { ctx.findings.error('invalid-value', file, pointer, msg); return null; };
    const isByte = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 0xFF;
    const isWord = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 0xFFFF;
    const bytesHex = (s: unknown, p: string) => typeof s === 'string' && /^([0-9a-f]{2})*$/.test(s) ? new Uint8Array(Buffer.from(s, 'hex')) : bad(p, 'hex bytes');
    const bytesB64 = (s: unknown, p: string) => typeof s === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(s) ? new Uint8Array(Buffer.from(s, 'base64')) : bad(p, 'base64 bytes');
    /** A payload under its noted compression: the kept vanilla bytes while they still unpack to it, else ours. */
    const pack = (payload: Uint8Array, g: any, p: string): Block | null => {
        if (g.compression === 'none') return { sub: blocks.SUB_RAW, decomp: payload.length, data: payload };
        if (g.compression !== 'lzss') return bad(p + '/compression', '"lzss" or "none"');
        if (g.packed !== undefined) {
            const packed = bytesB64(g.packed, p + '/packed');
            if (!packed) return null;
            const kept: Block = { sub: blocks.SUB_LZSS, decomp: payload.length, data: packed };
            let unpacked: Uint8Array | null = null;
            try { unpacked = blocks.unpackBlock(kept); } catch { /* stale: compress anew */ }
            if (unpacked && unpacked.length === payload.length && unpacked.every((x, i) => x === payload[i])) return kept;
            ctx.findings.info('repacked', file, p + '/packed', 'the packed bytes no longer give this data; compressed anew');
        }
        return { sub: blocks.SUB_LZSS, decomp: payload.length, data: blocks.lzssCompressVanilla(payload) };
    };
    const triggers = (list: any, p: string): Trigger[] | null => {
        if (!Array.isArray(list)) return bad(p, 'a list of { area: [y1, x1, y2, x2], script }');
        const out: Trigger[] = [];
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            if (!t || !Array.isArray(t.area) || t.area.length !== 4 || !t.area.every(isByte)) return bad(`${p}/${i}/area`, 'four bytes: y1, x1, y2, x2');
            if (!isWord(t.script)) return bad(`${p}/${i}/script`, 'a script id (word)');
            out.push({ y1: t.area[0], x1: t.area[1], y2: t.area[2], x2: t.area[3], scriptId: t.script });
        }
        return out;
    };
    if (v?.format !== FORMAT || v?.version !== VERSION) { ctx.findings.error('schema', file, '/format', `"${FORMAT}", version ${VERSION}`); return null; }
    const header = bytesHex(v.header, '/header');
    if (header && header.length !== 13) return bad('/header', '13 bytes');
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
    const graphics = (g: any, p: string): Block | null => {
        if (!g || !Array.isArray(g.tiles)) return bad(p, '{ compression, tiles: [tile name, …], packed?: base64 }');
        const ids: number[] = [];
        for (let i = 0; i < g.tiles.length; i++) { const id = tileId(g.tiles[i], `${p}/tiles/${i}`, false); if (id === null) return null; ids.push(id); }
        return pack(graphicPayload(ids), g, p);
    };
    const grid = (g: any, p: string, hdr: Uint8Array | null, section4: Uint8Array | null): Block | null => {
        if (!hdr || !section4) return null;
        const w = hdr[2], h = hdr[3], base = 2 * w * h;
        if (!g || g.compression !== 'markov' || !Array.isArray(g.rows)) return bad(p, '{ compression: "markov", rows: [[metatile index, …], …] }');
        if (g.rows.length !== h) return bad(p + '/rows', `${h} rows (header byte 3)`);
        const ids: number[] = [];
        for (let y = 0; y < h; y++) {
            const row = g.rows[y];
            if (!Array.isArray(row) || row.length !== w || !row.every((n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 0x2000)) return bad(`${p}/rows/${y}`, `${w} metatile indices 0-8191 (header byte 2)`);
            for (const n of row) ids.push(base + 8 * n);
        }
        try { return blocks.encodeBlock2(ids, w, h, base, fc4Of(section4)); }
        catch (e) { return bad(p + '/rows', (e as Error).message); }
    };
    const metatiles = (g: any, p: string): Block | null => {
        if (!g || !Array.isArray(g.list)) return bad(p, '{ compression, list: [[canopy, terrain, collision], …], packed?: base64 }');
        const n = g.list.length, payload = new Uint8Array(n * 6);
        for (let k = 0; k < n; k++) {
            const t = g.list[k];
            if (!Array.isArray(t) || t.length !== 3 || !t.every((x: unknown) => typeof x === 'string' && /^[0-9a-f]{4}$/.test(x))) return bad(`${p}/list/${k}`, 'three words as 4 hex digits: canopy, terrain, collision');
            t.forEach((x: string, slice: number) => { const v = parseInt(x, 16); payload[(slice * n + k) * 2] = v & 0xFF; payload[(slice * n + k) * 2 + 1] = v >> 8; });
        }
        return pack(payload, g, p);
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
    const words = (list: unknown, p: string, max: number) => Array.isArray(list) && list.length <= max && list.every(isWord) ? list as number[] : bad(p, `at most ${max} words`);
    const anim = animations(v.animations, '/animations');
    const section4 = bytesB64(v.section4, '/section4');
    const m = {
        header, stepOn: triggers(v.stepOn, '/stepOn'), bTrigger: triggers(v.bTrigger, '/bTrigger'),
        tileFamilies: familyIds(v.tileFamilies, '/tileFamilies'), extras: bytesHex(v.extras, '/extras'),
        block1: graphics(v.graphics, '/graphics'), section2Count: anim && anim.length,
        section2Data: anim && section2Bytes(anim), objectOffsets: words(v.objectOffsets, '/objectOffsets', 0xFF),
        block2: grid(v.grid, '/grid', header, section4), section4, block3: metatiles(v.metatiles, '/metatiles'),
        objectArea: bytesB64(v.objectArea, '/objectArea'),
    };
    if (m.extras && m.extras.length % 3) return bad('/extras', 'whole 3-byte descriptors');
    return Object.values(m).some(x => x === null) ? null : m as RoomModel;
}

/** The blob `value` (a map.json as explode writes it) implodes to, ids taken from `name`: explode's own check. */
function lossless(value: unknown, ids: Map<string, Map<string, number>>): Uint8Array {
    const findings = new Findings();
    const model = fromJson(JSON.parse(JSON.stringify(value)), 'explode', { ids, findings, marks: new Map() } as unknown as ImplodeContext);
    if (!model) throw new Error('explode wrote a map.json it cannot read: ' + findings.list.map(f => f.message).join('; '));
    return maps.buildBlob(model);
}

export const mapsCodec: Codec = {
    kind: 'maps', version: 4, path: DIR,
    derived: ['packed'],

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
            const value = toJson(model, f => name(FAMILIES, f), t => name(TILES, t));
            if (sha1(lossless(value, ids)) !== sha1(rom.subarray(at, end))) throw new Error(`room ${id}: map.json does not give its bytes back; explode would lose data`);
            files.set(`${DIR}/${n}/${FILE}`, json(value));
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
            if (file === FILE && more === undefined) names.add(name);
            else findings.warning('unknown-file', path, '', `a map folder holds only ${FILE}; ignored`);
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx;
        const items: Item[] = [];
        for (const name of names) {
            const file = `${DIR}/${name}/${FILE}`;
            if (!NAME_RE.test(name)) { findings.error('bad-name', file, '', `"${name}": snake_case, at most 80 characters`); continue; }
            let value: unknown;
            try { value = JSON.parse(readText(tree.get(file)!)); }
            catch (e) { findings.error('parse-error', file, '', (e as Error).message); continue; }
            const model = fromJson(value, file, ctx);
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
