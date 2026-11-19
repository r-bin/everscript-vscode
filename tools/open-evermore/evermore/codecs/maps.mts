// The `maps` kind (docs/open-evermore/resources.md §maps): every room as a folder maps/<name>/ (map.json, grid.txt,
// metatiles.json, objects.json; preview.png: the room drawn, for the reader only), reached only through the map
// table implode writes. The files are the repo's own (`maps/tree-map.ts`, which the Rooms tab reads too); this file
// names, reads and writes them and checks. Explode proves every room comes back from its files byte for byte.
//
// Facts used (docs/map-format/room-reference.md, docs/table-hack.md §1-2, docs/extension-tables.md):
//   map table   one entry per id × [24-bit pointer, pad 0], vanilla 127 at $9F:FDE7; read only by `lda.l` at
//               $90:8F69 (table) / $90:8F6F (table + 1)
//   enter table one entry per id × [packed script pointer, word], vanilla 127 at $92:801B, its last word on top of
//               the script pointer table; read only by `lda.l` at $8C:CECC (table) / $8C:CED2 (table + 1), which
//               read bytes 0-2 (the word is never read there)
//   ids         up to 256: the enter-script lookup multiplies the id byte by 5 in the 8×8 hardware multiplier
//   pointer     bus form $80-$BF:8000+ (= 0x800000 | file offset of an upper half)
//   blob        upper half of a bank, never across a bank, at most 32 KiB
// Both tables are generated items: in place while the ids fit them (G0), elsewhere once a map is added, with the
// four reader operands rewritten. Enter scripts are named (scripts/<name>.txt), keyed by map name in
// maps/_enter_scripts.json, not in a map's
// folder: copying a map's files over another keeps the target's enter script (the intro's fade-in for room 0x61).
// References to exploded kinds are names (tileFamilies → tile_families/, graphics and animation frames →
// tiles/); the ids of kinds not exploded yet (script ids) stay numbers until their kinds are.
import { createRequire } from 'node:module';
import { fileOfPacked, packedOf, scriptLayout } from './scripts.mts';
import { mark } from '../../codec.mts';
import type { Codec, ImplodeContext, Item, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { Findings } from '../../findings.mts';
import { json, NAME_RE, readText, sha1, text, withoutKeys } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');
const treeMap = require('../../../../dist/games/evermore/maps/tree-map');
const ROOMS: { id: number; path: string }[] = require('../../../../src/games/evermore/localizations/data/rooms.json');

const { TREE_MAP } = treeMap;
const DIR = 'maps', FILE = TREE_MAP.map, PREVIEW = 'preview.png';
/** The files of a room folder implode reads, as treeMap's keys. */
const PARTS: [string, string][] = Object.entries(TREE_MAP);
const STRIDE = 4, VANILLA = 127, LIMIT = 256, MAX_BLOB = 0x8000;
const ENTER = '_enter_scripts.json', ENTER_STRIDE = 5, SCRIPTS = 'scripts';
/** The reader operands (file offsets of the 24-bit operand of each `lda.l`) and what they add to the table. */
const READERS = {
    table: [{ at: 0x108F6A, add: 0 }, { at: 0x108F70, add: 1 }],
    enter: [{ at: 0x0CCECD, add: 0 }, { at: 0x0CCED3, add: 1 }],
};
/** The generated items: the map table and the enter-script table (the last entry's word dropped: never read). */
const TABLE = `${DIR}/_map_table`, ENTER_TABLE = `${DIR}/_enter_table`;
const tableLength = (n: number) => n * STRIDE, enterLength = (n: number) => n * ENTER_STRIDE - 2;
/** An enter-script record as maps/_enter_scripts.json writes it: a script in scripts/, or null for none (packed
 *  pointer 0, Brian's room), and the word after the pointer. */
interface Enter { script: string | null; word: string }
const NONE: Enter = { script: null, word: '$0000' };
const hexOf = (v: number, digits: number) => '$' + v.toString(16).toUpperCase().padStart(digits, '0');
const FAMILIES = 'tile_families', TILES = 'tiles';

/** The 24-bit operand of a reader, as the file offset of the table it reads. */
const operand = (rom: Uint8Array, r: { at: number; add: number }) => maps.romFileOffset(rom, rom[r.at] | rom[r.at + 1] << 8 | rom[r.at + 2] << 16) - r.add;

/** The map table and the enter-script table, found through their readers (both may have moved). */
export function locate(rom: Uint8Array): { table: number; enter: number } {
    const [table, table1] = READERS.table.map(r => operand(rom, r)), [enter, enter1] = READERS.enter.map(r => operand(rom, r));
    if (rom[READERS.table[0].at - 1] !== 0xBF || table !== table1 || enter !== enter1) throw new Error('the map table readers are not the ones this codec knows ($90:8F69, $8C:CECC); another release?');
    return { table, enter };
}

/** Each map's blob (file offset) by id: `count` from the maps enum on a round trip, else vanilla's 127. Every kind
 *  that walks the rooms goes through here, so a moved or grown map table is followed. */
export function roomBlobs(rom: Uint8Array, count = VANILLA): number[] {
    const { table } = locate(rom);
    return Array.from({ length: count }, (_, id) => maps.romFileOffset(rom, maps.read24(rom, table + id * STRIDE)));
}

/** Our own room names (data/rooms.json `path`, D4), as snake case. */
export function mapName(id: number): string {
    const room = ROOMS.find(r => r.id === id);
    return room ? room.path.replace(/[/-]/g, '_').replace(/[^a-z0-9_]/g, '') : 'map_' + id.toString(16).padStart(2, '0');
}

/** A room's files (all but preview.png, which explode draws). */
function toFiles(model: unknown, family: (id: number) => string, tile: (id: number) => string): Map<string, Uint8Array> {
    const f = treeMap.roomToTree(model, { family, tile });
    return new Map(PARTS.map(([key, file]) => [file, key === 'grid' ? text(f.grid) : json(f[key])]));
}

/** A room folder's files → blob; every problem is a finding with its file and JSON pointer (grid.txt: /row/column). */
function fromFiles(files: Map<string, Uint8Array | undefined>, dir: string, ctx: ImplodeContext): Uint8Array | null {
    const values: Record<string, unknown> = {};
    for (const [key, file] of PARTS) {
        const b = files.get(file), path = `${dir}/${file}`;
        if (!b) { ctx.findings.error('missing-file', path, '', `a map folder holds ${PARTS.map(p => p[1]).join(', ')}`); return null; }
        if (key === 'grid') { values.grid = readText(b); continue; }
        try { values[key] = JSON.parse(readText(b)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); return null; }
    }
    const families = ctx.ids.get(FAMILIES) ?? new Map<string, number>(), tiles = ctx.ids.get(TILES) ?? new Map<string, number>();
    const refs = {
        family: (name: string) => families.get(name),
        tile(name: string, dma: boolean) {
            const id = tiles.get(name);
            if (id !== undefined) { mark(ctx, `${TILES}/${name}`, 'used'); if (dma) mark(ctx, `${TILES}/${name}`, 'dma'); }
            return id;
        },
    };
    return treeMap.blobFromTree(values, refs, (p: { level: string; code: string; file: string; pointer: string; message: string }) =>
        p.level === 'info' ? ctx.findings.info(p.code, `${dir}/${p.file}`, p.pointer, p.message) : ctx.findings.error(p.code, `${dir}/${p.file}`, p.pointer, p.message));
}

/** The blob a room's files implode to, ids taken from `ids`: explode's own check. */
function lossless(files: Map<string, Uint8Array>, ids: Map<string, Map<string, number>>): Uint8Array {
    const findings = new Findings();
    const blob = fromFiles(files, 'explode', { ids, findings, marks: new Map() } as unknown as ImplodeContext);
    if (!blob) throw new Error('explode wrote room files it cannot read: ' + findings.list.map(f => `${f.file}#${f.pointer} ${f.message}`).join('; '));
    return blob;
}

/** maps/_enter_scripts.json by map name; errors for a bad record, a name that is no map or a script that is none. */
function enterScripts(ctx: ImplodeContext, names: Set<string>): Map<string, { script: string | null; word: number }> {
    const path = `${DIR}/${ENTER}`, out = new Map<string, { script: string | null; word: number }>();
    const scripts = ctx.names.get(SCRIPTS) ?? new Set<string>();
    const raw = ctx.tree.get(path);
    if (!raw) return out;      // no enter scripts at all: every map has none
    let file: { scripts?: Record<string, Enter> };
    try { file = JSON.parse(readText(raw)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); return out; }
    for (const [name, e] of Object.entries(file.scripts ?? {})) {
        const num = (v: unknown, max: number) => typeof v === 'string' && /^\$[0-9a-fA-F]+$/.test(v) && parseInt(v.slice(1), 16) <= max ? parseInt(v.slice(1), 16) : null;
        const word = num(e?.word, 0xFFFF), script = e?.script ?? null;
        if (!names.has(name)) ctx.findings.error('unknown-reference', path, `/scripts/${name}`, `"${name}" is no map in ${DIR}/`);
        else if (word === null || (script !== null && typeof script !== 'string')) ctx.findings.error('invalid-value', path, `/scripts/${name}`, '{ "script": "<a script in scripts/>" | null, "word": "$xxxx" }');
        else if (script !== null && !scripts.has(script)) ctx.findings.error('unknown-reference', path, `/scripts/${name}/script`, `"${script}" is no script in ${SCRIPTS}/`);
        else { out.set(name, { script, word }); if (script !== null) mark(ctx, `${SCRIPTS}/${script}`, 'used'); }
    }
    return out;
}

export const mapsCodec: Codec = {
    kind: 'maps', version: treeMap.TREE_MAP_VERSION, path: DIR,
    // preview.png shows the room; nothing reads it back.
    canonical(path, bytes) {
        if (path.endsWith('/' + PREVIEW)) return null;
        if (path === `${DIR}/${ENTER}`) {
            const v = JSON.parse(readText(bytes));
            const scripts = Object.entries(v.scripts ?? {}).filter(([, e]) => JSON.stringify(e) !== JSON.stringify(NONE)).sort(([a], [b]) => a < b ? -1 : 1);
            return [path, json(Object.fromEntries(scripts))];
        }
        // Hand-written text may order flags or pad numbers differently: compare what it means.
        const cells = (rows: string[]) => rows.map(r => r.trim().split(/\s+/).map(t => /^[0-9a-f]+$/.test(t) ? parseInt(t, 16) : t));
        if (path.endsWith('/' + TREE_MAP.grid)) return [path, json(cells(readText(bytes).trim().split('\n')))];
        if (path.endsWith('/' + TREE_MAP.objects)) {
            const v = JSON.parse(readText(withoutKeys(path, bytes, ['id'])));
            for (const o of v.list ?? []) for (const st of o.states ?? []) if (Array.isArray(st.cells)) st.cells = cells(st.cells);
            return [path, json(v)];
        }
        if (path.endsWith('/' + TREE_MAP.metatiles)) {
            const v = JSON.parse(readText(withoutKeys(path, bytes, ['packed', 'id'])));
            const norm = (t: unknown) => typeof t === 'string' ? t.trim().split(/\s+/).sort().join(' ') : t;
            for (const e of v.list ?? []) for (const k of ['canopy', 'terrain', 'collision']) e[k] = norm(e[k]);
            return [path, json(v)];
        }
        return [path, withoutKeys(path, bytes, ['packed'])];
    },

    defaultName: mapName,

    explode(rom, name, _options, countOf, nameAt) {
        const files: Tree = new Map();
        const count = countOf('maps') ?? VANILLA;
        const { table, enter } = locate(rom), blobs = roomBlobs(rom, count);
        const names: string[] = [];
        const scripts: Record<string, Enter> = {};
        const scriptNames = scriptLayout(rom, name, countOf, nameAt).byAt;
        const pool = [], homes = [];
        const ids = new Map<string, Map<string, number>>();
        const by = (kind: string, count: number) => new Map(Array.from({ length: count }, (_, id) => [name(kind, id), id] as [string, number]));
        ids.set(FAMILIES, by(FAMILIES, 1024));
        ids.set(TILES, by(TILES, 0x10000 / 3 | 0));
        for (let id = 0; id < count; id++) {
            const at = blobs[id];
            const end = maps.objectAreaEnd(rom, maps.parseBlobLayout(rom, at));
            const model = maps.modelFromRom(rom, id, at);
            const n = name('maps', id);
            names.push(n);
            const room = toFiles(model, f => name(FAMILIES, f), t => name(TILES, t));
            if (sha1(lossless(room, ids)) !== sha1(rom.subarray(at, end))) throw new Error(`room ${id}: its files do not give its bytes back; explode would lose data`);
            for (const [f, bytes] of room) files.set(`${DIR}/${n}/${f}`, bytes);
            files.set(`${DIR}/${n}/${PREVIEW}`, new Uint8Array(maps.encodePng(maps.renderRoomComposite(rom, maps.decodeRoom(rom, id, at)))));
            const e = enter + id * ENTER_STRIDE, packed = maps.read24(rom, e), word = id < count - 1 ? maps.read16(rom, e + 3) : 0;
            // The last entry's word is never read (vanilla's lies on the script pointer table): only a pointer is kept.
            if (packed || word) scripts[n] = { script: packed ? scriptNames.get(fileOfPacked(packed))!.name : null, word: hexOf(word, 4) };
            const blob = rom.subarray(at, end);
            pool.push({ start: at, end });
            homes.push({ key: `${DIR}/${n}`, at, length: blob.length, sha1: sha1(blob) });
        }
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: 'maps', limit: LIMIT, names,
            why: `the enter-script lookup multiplies the id byte by 5 in the 8×8 hardware multiplier; past ${VANILLA} maps the map and enter-script tables move`,
        }));
        files.set(`${DIR}/${ENTER}`, json({
            why: 'each map\'s room enter script, by map name: a script in scripts/ (null: none) and the word after its pointer (not read by the room loader); a map not listed has none',
            scripts,
        }));
        pool.push({ start: table, end: table + tableLength(count) }, { start: enter, end: enter + enterLength(count) });
        homes.push({ key: TABLE, at: table, length: tableLength(count), sha1: sha1(rom.subarray(table, table + tableLength(count))) });
        homes.push({ key: ENTER_TABLE, at: enter, length: enterLength(count), sha1: sha1(rom.subarray(enter, enter + enterLength(count))) });
        return { files, pool, tables: [...READERS.table, ...READERS.enter].map(r => ({ start: r.at, end: r.at + 3 })), homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}` || path === `${DIR}/${ENTER}`) continue;
            const [, name, file, more] = path.split('/');
            if (file !== undefined && more === undefined && [...PARTS.map(p => p[1]), PREVIEW].includes(file)) names.add(name);
            else findings.warning('unknown-file', path, '', `a map folder holds ${PARTS.map(p => p[1]).join(', ')} and ${PREVIEW}; ignored`);
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx;
        const items: Item[] = [];
        for (const name of names) {
            const dir = `${DIR}/${name}`, file = `${dir}/${FILE}`;
            if (!NAME_RE.test(name)) { findings.error('bad-name', file, '', `"${name}": snake_case, at most 80 characters`); continue; }
            const bytes = fromFiles(new Map(PARTS.map(([, f]) => [f, tree.get(`${dir}/${f}`)])), dir, ctx);
            if (!bytes) continue;
            if (bytes.length > MAX_BLOB) { findings.error('over-budget', file, '', `blob of ${bytes.length} bytes; a room is at most ${MAX_BLOB}`); continue; }
            items.push({ key: `${DIR}/${name}`, file, bytes, rule: { upperHalf: true, noCrossBank: true, maxSize: MAX_BLOB } });
        }
        const count = Math.max(0, ...(ctx.ids.get('maps')?.values() ?? [])) + 1;
        enterScripts(ctx, names);
        // Long-indexed reads; kept inside one bank like vanilla's.
        items.push({ key: TABLE, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(tableLength(count)), rule: { noCrossBank: true }, generated: true });
        items.push({ key: ENTER_TABLE, file: `${DIR}/${ENTER}`, bytes: new Uint8Array(enterLength(count)), rule: { noCrossBank: true }, generated: true });
        return items;
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get('maps');
        const at = placed.get(TABLE), enterAt = placed.get(ENTER_TABLE);
        if (!ids || at === undefined || enterAt === undefined) return [];
        const byId = new Map([...ids].map(([name, id]) => [id, name]));
        const count = Math.max(0, ...ids.values()) + 1;
        const bytes = new Uint8Array(tableLength(count)), enter = new Uint8Array(count * ENTER_STRIDE);
        const scripts = enterScripts(ctx, new Set(ids.keys()));
        for (let id = 0; id < count; id++) {
            const name = byId.get(id);
            if (name === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no map has id ${id}; the map table cannot skip one yet`); continue; }
            const blob = placed.get(`${DIR}/${name}`);
            if (blob === undefined) continue;
            const bus = ctx.pointer(blob);
            bytes.set([bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16, 0], id * STRIDE);
            const s = scripts.get(name), at = s?.script ? ctx.symbols.get(`${SCRIPTS}/${s.script}`) : undefined;
            const e = { packed: at === undefined ? 0 : packedOf(at), word: s?.word ?? 0 };
            enter.set([e.packed & 0xFF, (e.packed >> 8) & 0xFF, e.packed >> 16, e.word & 0xFF, e.word >> 8], id * ENTER_STRIDE);
        }
        const operands = (readers: { at: number; add: number }[], to: number, file: string): Write[] => readers.map(r => {
            const bus = ctx.pointer(to) + r.add;
            return { at: r.at, bytes: new Uint8Array([bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16]), file };
        });
        return [
            { at, bytes, file: `${DIR}/${ENUM}` },
            { at: enterAt, bytes: enter.subarray(0, enterLength(count)), file: `${DIR}/${ENTER}` },
            ...operands(READERS.table, at, `${DIR}/${ENUM}`), ...operands(READERS.enter, enterAt, `${DIR}/${ENTER}`),
        ] satisfies Write[];
    },
};
