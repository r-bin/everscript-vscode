// The `tiles` kind (docs/open-evermore/resources.md §tiles): the 16×16 map graphics, one file of pixels per tile,
// reached only through the pointer table implode writes.
//
// Facts used (docs/map-format/map_tile_graphics_decompression.md, checked in VRAM 2026-11-19):
//   table      6,688 × 24-bit pointer at $EE0000 (file 0x2E0000), read by $8C:C898 / $8C:C8A1 and $90:A16A /
//              $90:A23D (lda.l $EE0000,x with x = id·3); implode rewrites it in place, in tiles/_enum.json order
//   pointer    a graphic in a bank's upper half has the $80-$BF form, in the lower half the $C0-$FF form
//   graphic    encoded by `encodeTile` (src/games/evermore/maps/chr.ts), which gives back 6,682 of the vanilla
//              graphics; the six in bit-6 form keep their bytes in `encoded`. Two of those (run form) make the game
//              fetch three bytes past their own end, from the graphic stored after them (`followedBy`): implode
//              places the pair as one item while both still give their pixels
//   placement  never across a bank (the loader and the streamer read through DMA, whose source stays in its bank);
//              an animation frame (marked `dma` by the maps kind) is stored as 64 raw words, since the streamer
//              $90:A1B4 DMAs 128 bytes from +1
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');
const { getMapTileGraphicsOffset } = require('../../../../dist/games/evermore/variant-resolver');

export const KIND = 'tiles';
const DIR = KIND, COUNT = 6688, ROOMS = 127;
const FORMAT = 'open-evermore/tile', VERSION = 1;

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Every graphic an animation channel shows, in any room (the streamer DMAs them raw). */
function animationFrames(rom: Uint8Array): Set<number> {
    const frames = new Set<number>();
    for (let id = 0; id < ROOMS; id++) {
        const m = maps.modelFromRom(rom, id), d: Uint8Array = m.section2Data;
        for (let c = 0; c < m.section2Count; c++) {
            const count = d[c * 4 + 1], offset = d[c * 4 + 2] | (d[c * 4 + 3] << 8);
            for (let k = 0; k < count; k++) frames.add(d[offset + k * 3 + 1] | (d[offset + k * 3 + 2] << 8));
        }
    }
    return frames;
}

/** 128 graphic bytes ↔ 16 rows of 16 palette indices, one hex digit each. */
const toRows = (bytes: Uint8Array): string[] => {
    const px: Uint8Array = maps.decodeTilePixels(bytes);
    return Array.from({ length: 16 }, (_, y) => Array.from(px.subarray(y * 16, y * 16 + 16), p => p.toString(16)).join(''));
};

/** Where each tile's bytes went, for `tables`: a tile placed after the one that reads into it has no item. */
const pairs = new WeakMap<ImplodeContext, Map<string, { key: string; offset: number }>>();

export const tilesCodec: Codec = {
    kind: KIND, version: 1, path: DIR,

    defaultName: id => 'tile_' + id.toString(16).padStart(4, '0'),

    explode(rom, name) {
        const table = getMapTileGraphicsOffset(rom);
        const frames = animationFrames(rom);
        const at = Array.from({ length: COUNT }, (_, id) => maps.tileGraphicOffset(rom, id) as number);
        const starts = [...at].sort((a, b) => a - b);
        const nextStart = (a: number) => { const i = starts.findIndex(s => s > a); return i < 0 ? Infinity : starts[i]; };
        const files: Tree = new Map();
        const names: string[] = [];
        const own: { start: number; end: number; follower: number }[] = [];
        for (let id = 0; id < COUNT; id++) {
            const { bytes, end } = maps.decodeTile(rom, at[id]);
            const next = nextStart(at[id]);
            const stored = Math.min(end, next);
            const n = name(KIND, id);
            names.push(n);
            const file: Record<string, unknown> = { format: FORMAT, version: VERSION, pixels: toRows(bytes) };
            if (!same(maps.encodeTile(bytes, frames.has(id)), rom.subarray(at[id], end)) || stored < end) {
                file.encoded = hex(rom.subarray(at[id], stored));
                if (stored < end) file.followedBy = name(KIND, at.indexOf(next));
            }
            own.push({ start: at[id], end: stored, follower: stored < end ? at.indexOf(next) : -1 });
            files.set(`${DIR}/${n}.json`, json(file));
        }
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: KIND, limit: COUNT, names,
            why: `the pointer table at $EE0000 holds ${COUNT} entries and stays where it is for now (its readers index it with id·3 in 16 bits: 21,845 after a move)`,
        }));
        const followers = new Set(own.map(o => o.follower).filter(f => f >= 0));
        const homes = [];
        for (let id = 0; id < COUNT; id++) {
            if (followers.has(id)) continue;
            const o = own[id];
            const end = o.follower >= 0 ? own[o.follower].end : o.end;
            homes.push({ key: `${DIR}/${names[id]}`, at: o.start, length: end - o.start, sha1: sha1(rom.subarray(o.start, end)) });
        }
        return { files, pool: own.map(o => ({ start: o.start, end: o.end })), tables: [{ start: table, end: table + COUNT * 3 }], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^tiles\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]);
            else findings.warning('unknown-file', path, '', 'a tile is one <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx;
        const ids = ctx.ids.get(KIND);
        if (!ids) return [];
        interface Tile { bytes: Uint8Array; encoded?: Uint8Array; followedBy?: string; file: string; out?: Uint8Array }
        const tiles = new Map<string, Tile>();
        for (const n of [...names].sort()) {
            const file = `${DIR}/${n}.json`;
            if (!NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: any;
            try { v = JSON.parse(readText(tree.get(file)!)); }
            catch (e) { findings.error('parse-error', file, '', (e as Error).message); continue; }
            if (v?.format !== FORMAT || v?.version !== VERSION) { findings.error('schema', file, '/format', `"${FORMAT}", version ${VERSION}`); continue; }
            if (!Array.isArray(v.pixels) || v.pixels.length !== 16) { findings.error('invalid-value', file, '/pixels', '16 rows'); continue; }
            const bad = v.pixels.findIndex((r: unknown) => typeof r !== 'string' || !/^[0-9a-f]{16}$/.test(r));
            if (bad >= 0) { findings.error('invalid-value', file, `/pixels/${bad}`, '16 palette indices, one hex digit each (0-f)'); continue; }
            const t: Tile = { bytes: maps.encodeTilePixels(v.pixels.flatMap((r: string) => [...r].map(c => parseInt(c, 16)))), file };
            if (v.encoded !== undefined) {
                if (typeof v.encoded !== 'string' || !/^([0-9a-f]{2})+$/.test(v.encoded)) { findings.error('invalid-value', file, '/encoded', 'hex bytes'); continue; }
                t.encoded = new Uint8Array(Buffer.from(v.encoded, 'hex'));
            }
            if (v.followedBy !== undefined) {
                if (!names.has(v.followedBy)) { findings.error('unknown-reference', file, '/followedBy', `no tile "${v.followedBy}" in ${DIR}/`); continue; }
                t.followedBy = v.followedBy;
            }
            if (!ctx.marks.get(`${DIR}/${n}`)?.has('used')) findings.warning('unreferenced', file, '', 'no map uses this tile');
            tiles.set(n, t);
        }
        // Each tile on its own: its vanilla bytes while they still give its pixels, else our encoder.
        const reencoded = (t: Tile) => findings.info('reencoded', t.file, '/encoded', 'the stored bytes no longer give these pixels; encoded anew');
        for (const [n, t] of tiles) {
            const dma = ctx.marks.get(`${DIR}/${n}`)?.has('dma') ?? false;
            if (t.encoded && !dma && !t.followedBy) {
                const d = maps.decodeTile(t.encoded, 0);
                if (d.end <= t.encoded.length && same(d.bytes, t.bytes)) { t.out = t.encoded; continue; }
                reencoded(t);
            }
            t.out = maps.encodeTile(t.bytes, dma);
        }
        // A tile that reads into the next one: one item with it, while both still give their pixels.
        const pairOf = new Map<string, { key: string; offset: number }>();
        pairs.set(ctx, pairOf);
        const items: Item[] = [];
        for (const [n, t] of tiles) {
            const f = t.followedBy && tiles.get(t.followedBy);
            if (t.encoded && f && !ctx.marks.get(`${DIR}/${n}`)?.has('dma') && !pairOf.has(t.followedBy!) && !tiles.get(t.followedBy!)?.followedBy) {
                const both = new Uint8Array([...t.encoded, ...f.out!]);
                const d = maps.decodeTile(both, 0);
                if (d.end <= both.length && same(d.bytes, t.bytes)) {
                    pairOf.set(t.followedBy!, { key: `${DIR}/${n}`, offset: t.encoded.length });
                    items.push({ key: `${DIR}/${n}`, file: t.file, bytes: both, rule: { noCrossBank: true } });
                    continue;
                }
                reencoded(t);
            }
        }
        const paired = new Set(items.map(i => i.key));
        for (const [n, t] of tiles) {
            if (pairOf.has(n) || paired.has(`${DIR}/${n}`)) continue;
            items.push({ key: `${DIR}/${n}`, file: t.file, bytes: t.out!, rule: { noCrossBank: true } });
        }
        return items;
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(KIND);
        if (!ids) return [];
        const pairOf = pairs.get(ctx) ?? new Map();
        const table = ctx.base.tables.find(t => t.kind === KIND);
        if (!table) return [];
        const bytes = new Uint8Array(table.end - table.start);
        for (const [n, id] of ids) {
            const p = pairOf.get(n);
            const at = p ? placed.get(p.key)! + p.offset : placed.get(`${DIR}/${n}`);
            if (at === undefined) continue;
            const bus = ((at & 0xFFFF) >= 0x8000 ? 0x800000 : 0xC00000) | at;
            bytes.set([bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16], id * 3);
        }
        return [{ at: table.start, bytes, file: `${DIR}/${ENUM}` }];
    },
};
