// The `maps` kind (docs/open-evermore/resources.md §maps): every room as maps/<name>/map.json, reached only through
// the map table implode writes. Decoding and encoding are the repo's own (`modelFromRom` / `buildBlob`, round trip
// of all 127 rooms); this file only names, serialises and checks.
//
// Facts used (docs/map-format/room-reference.md, docs/table-hack.md §1):
//   map table   127 entries × [24-bit pointer, pad 0], read by $90:8F69 / $90:8F6F; implode rewrites it in place,
//               in the order of maps/_enum.json
//   pointer     bus form $80-$BF:8000+ (= 0x800000 | file offset of an upper half)
//   blob        upper half of a bank, never across a bank, at most 32 KiB
// The blob still holds ids of resources no kind owns yet (tile families, graphics, script ids): they stay numbers
// until those kinds are exploded.
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');
const ROOMS: { id: number; path: string }[] = require('../../../../src/games/evermore/localizations/data/rooms.json');

const DIR = 'maps', FILE = 'map.json';
const STRIDE = 4, COUNT = 127, MAX_BLOB = 0x8000;
const FORMAT = 'open-evermore/map', VERSION = 1;

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
const block = (b: Block) => ({ sub: b.sub, decomp: b.decomp, data: b64(b.data) });
const trigger = (t: Trigger) => ({ area: [t.y1, t.x1, t.y2, t.x2], script: t.scriptId });

function toJson(m: RoomModel): unknown {
    return {
        format: FORMAT, version: VERSION,
        header: hex(m.header),
        stepOn: m.stepOn.map(trigger),
        bTrigger: m.bTrigger.map(trigger),
        tileFamilies: m.tileFamilies,
        extras: hex(m.extras),
        block1: block(m.block1),
        section2: { count: m.section2Count, data: b64(m.section2Data) },
        objectOffsets: m.objectOffsets,
        block2: block(m.block2),
        section4: b64(m.section4),
        block3: block(m.block3),
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
    const blk = (b: any, p: string): Block | null => {
        if (!b || !isByte(b.sub) || !isWord(b.decomp)) return bad(p, '{ sub: byte, decomp: word, data: base64 }');
        const data = bytesB64(b.data, p + '/data');
        return data && { sub: b.sub, decomp: b.decomp, data };
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
    const words = (list: unknown, p: string, max: number) => Array.isArray(list) && list.length <= max && list.every(isWord) ? list as number[] : bad(p, `at most ${max} words`);
    const m = {
        header, stepOn: triggers(v.stepOn, '/stepOn'), bTrigger: triggers(v.bTrigger, '/bTrigger'),
        tileFamilies: words(v.tileFamilies, '/tileFamilies', 0xFF), extras: bytesHex(v.extras, '/extras'),
        block1: blk(v.block1, '/block1'), section2Count: isByte(v.section2?.count) ? v.section2.count : bad('/section2/count', 'a byte'),
        section2Data: bytesB64(v.section2?.data, '/section2/data'), objectOffsets: words(v.objectOffsets, '/objectOffsets', 0xFF),
        block2: blk(v.block2, '/block2'), section4: bytesB64(v.section4, '/section4'), block3: blk(v.block3, '/block3'),
        objectArea: bytesB64(v.objectArea, '/objectArea'),
    };
    if (m.extras && m.extras.length % 3) return bad('/extras', 'whole 3-byte descriptors');
    return Object.values(m).some(x => x === null) ? null : m as RoomModel;
}

export const mapsCodec: Codec = {
    kind: 'maps', version: 1, path: DIR,

    explode(rom, given) {
        const files: Tree = new Map();
        const table = maps.mapTableOffset(rom);
        const names: string[] = [];
        const pool = [], homes = [];
        for (let id = 0; id < COUNT; id++) {
            const at = maps.roomBlobOffset(rom, id);
            const end = maps.objectAreaEnd(rom, maps.parseBlobLayout(rom, at));
            const model = maps.modelFromRom(rom, id);
            const blob: Uint8Array = maps.buildBlob(model);
            if (sha1(blob) !== sha1(rom.subarray(at, end))) throw new Error(`room ${id}: the encoder does not give its bytes back; explode would lose data`);
            const name = given?.[id] ?? mapName(id);
            names.push(name);
            files.set(`${DIR}/${name}/${FILE}`, json(toJson(model)));
            pool.push({ start: at, end });
            homes.push({ key: `${DIR}/${name}`, at, length: blob.length, sha1: sha1(blob) });
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
