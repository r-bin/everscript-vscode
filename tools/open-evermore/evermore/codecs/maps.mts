// The `maps` kind (docs/open-evermore/resources.md §maps): every room as a folder maps/<name>/ (map.json, grid.txt,
// metatiles.json, objects.json; preview.png: the room drawn, for the reader only), reached only through the map
// table implode writes. The files are the repo's own (`maps/tree-map.ts`, which the Rooms tab reads too); this file
// names, reads and writes them and checks. Explode proves every room comes back from its files byte for byte.
//
// Facts used (docs/map-format/room-reference.md, docs/table-hack.md §1):
//   map table   127 entries × [24-bit pointer, pad 0], read by $90:8F69 / $90:8F6F; implode rewrites it in place,
//               in the order of maps/_enum.json
//   pointer     bus form $80-$BF:8000+ (= 0x800000 | file offset of an upper half)
//   blob        upper half of a bank, never across a bank, at most 32 KiB
// References to exploded kinds are names (tileFamilies → tile_families/, graphics and animation frames →
// tiles/); the ids of kinds not exploded yet (script ids) stay numbers until their kinds are.
import { createRequire } from 'node:module';
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
const STRIDE = 4, COUNT = 127, MAX_BLOB = 0x8000;
const FAMILIES = 'tile_families', TILES = 'tiles';

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

export const mapsCodec: Codec = {
    kind: 'maps', version: treeMap.TREE_MAP_VERSION, path: DIR,
    // preview.png shows the room; nothing reads it back.
    canonical(path, bytes) {
        if (path.endsWith('/' + PREVIEW)) return null;
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
            const bus = ctx.pointer(at);
            bytes.set([bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16, 0], id * STRIDE);
        }
        const write: Write = { at: span.start, bytes, file: `${DIR}/${ENUM}` };
        return [write];
    },
};
