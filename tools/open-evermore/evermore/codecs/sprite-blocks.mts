// The `sprite_blocks_16` and `sprite_blocks_8` kinds (docs/open-evermore/resources.md §characters): the pixels sprite
// chunks are drawn from, one indexed PNG per block id (16×16 or 8×8, grey: the palette comes from the entity), reached
// only through the block table implode writes.
//
// Facts used (src/games/evermore/maps/sprites.ts, tools/table-hack/tables.js, where both tables were moved and proven):
//   table     3 bytes per id: a 16-bit address and a byte, bank = base + its low 7 bits, bit 7 = compressed. 16×16:
//             4,854 ids at $EC:0000, base $D9, read by `lda.l` at $80:9742 (table + 1), $80:9751, $80:A2E6; 8×8:
//             6,265 ids at $D8:0000, base $D1, read at $80:A4FC (table + 1), $80:A50B, $80:A800. Ids are 16-bit
//             byte offsets (X = 3·id): 21,845 at most
//   pixels    128 (16×16: four 8×8 4bpp tiles, top-left, top-right, bottom-left, bottom-right) or 32 bytes;
//             compressed: per 16 bytes a mask byte (bit w: word w is 0) then the other words. Vanilla compresses a
//             block exactly when that is shorter (every block, measured), so the PNG is all a block is
//   place     anywhere from the base bank to the end of the 4 MiB HiROM space, never across a bank
//   shared    8×8 block 6085 reads, raw, the 32 bytes that are blocks 0 and 407 compressed one after the other: a
//             block whose bytes are other blocks' is an alias, <name>.json { "bytes_of": [...], "compressed" },
//             and those blocks are placed together, in that order
import * as map from '../map.mts';
import { createRequire } from 'node:module';
import type { Codec, CountOf, ImplodeContext, Item, NameAt, NameOf, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { METASPRITE_NAME_RE, metaspriteNameMap } from './metasprites.mts';
import { readerSpans, readerWrites, tableAt } from './readers.mts';
import type { Reader } from './readers.mts';

const require = createRequire(import.meta.url);
const { decodePng, encodeIndexedPng } = require('../../../../dist/platform/png');
const { tile4bpp } = require('../../../../dist/platform/snes/tiles');
const { readSpriteInfo } = require('../../../../dist/games/evermore/maps/sprites');

const GREY = Array.from({ length: 16 }, (_, i) => [i * 17, i * 17, i * 17]);
/** Index 0 is transparent on a sprite. */
const ALPHA = [0, ...Array(15).fill(255)];
const GROUP = 16, LIMIT = 21845;

interface Spec { kind: string; size: number; bytes: number; base: number; vanilla: number; readers: Reader[]; where: string }

const hex4 = (id: number): string => id.toString(16).padStart(4, '0');
const ownerCache = new WeakMap<Uint8Array, Record<16 | 8, Map<number, string>>>();

/**
 * The folder each block goes in, from the chain block → metasprite → animation → owner: every metasprite that draws a
 * block votes with its owner (`boy`, `dog`, an enemy…); one owner keeps the block, several make it `shared`, none `misc`.
 */
function blockOwners(rom: Uint8Array, name: NameOf, countOf: CountOf, nameAt: NameAt): Record<16 | 8, Map<number, string>> {
    const hit = ownerCache.get(rom);
    if (hit) return hit;
    const votes: Record<16 | 8, Map<number, Set<string>>> = { 16: new Map(), 8: new Map() };
    for (const [addr, n] of metaspriteNameMap(rom, name, countOf, nameAt)) {
        const owner = n.slice(0, n.indexOf('/'));
        for (const c of readSpriteInfo(rom, addr).chunks as { large: boolean; block: number }[]) {
            const m = votes[c.large ? 16 : 8];
            let s = m.get(c.block);
            if (!s) m.set(c.block, s = new Set());
            s.add(owner);
        }
    }
    const out: Record<16 | 8, Map<number, string>> = { 16: new Map(), 8: new Map() };
    for (const size of [16, 8] as const) for (const [id, s] of votes[size]) out[size].set(id, s.size === 1 ? [...s][0] : 'shared');
    ownerCache.set(rom, out);
    return out;
}

/** 4bpp planar bytes of 8×8 indices (inverse of tile4bpp). */
function planar(px: Uint8Array, stride: number, x0: number, y0: number): number[] {
    const out = new Array(32).fill(0);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const v = px[(y0 + r) * stride + x0 + c], m = 0x80 >> c;
        if (v & 1) out[2 * r] |= m;
        if (v & 2) out[2 * r + 1] |= m;
        if (v & 4) out[16 + 2 * r] |= m;
        if (v & 8) out[17 + 2 * r] |= m;
    }
    return out;
}
function pixelsOf(raw: Uint8Array, size: number): Uint8Array {
    if (size === 8) return tile4bpp(raw);
    const px = new Uint8Array(256);
    for (let t = 0; t < 4; t++) {
        const tile = tile4bpp(raw, 32 * t), x0 = (t & 1) * 8, y0 = (t >> 1) * 8;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) px[(y0 + r) * 16 + x0 + c] = tile[r * 8 + c];
    }
    return px;
}
function rawOf(px: Uint8Array, size: number): Uint8Array {
    if (size === 8) return Uint8Array.from(planar(px, 8, 0, 0));
    return Uint8Array.from([0, 1, 2, 3].flatMap(t => planar(px, 16, (t & 1) * 8, (t >> 1) * 8)));
}
function compress(raw: Uint8Array): Uint8Array {
    const out: number[] = [];
    for (let g = 0; g < raw.length; g += GROUP) {
        let mask = 0;
        const words: number[] = [];
        for (let w = 0; w < GROUP / 2; w++) {
            const a = raw[g + 2 * w], b = raw[g + 2 * w + 1];
            if (!a && !b) mask |= 1 << w; else words.push(a, b);
        }
        out.push(mask, ...words);
    }
    return Uint8Array.from(out);
}
/** A block's stored bytes: compressed exactly when shorter (vanilla's rule). */
const stored = (raw: Uint8Array): { bytes: Uint8Array; compressed: boolean } => {
    const c = compress(raw);
    return c.length < raw.length ? { bytes: c, compressed: true } : { bytes: raw, compressed: false };
};

/** Each id's entry: file offset, stored length, compressed. */
function entries(rom: Uint8Array, s: Spec, table: number, count: number) {
    return Array.from({ length: count }, (_, id) => {
        const e = table + 3 * id, hi = rom[e + 2], at = ((s.base - 0xC0 + (hi & 0x7F)) << 16) | rom[e] | (rom[e + 1] << 8);
        const compressed = (hi & 0x80) !== 0;
        let length = s.bytes;
        if (compressed) { let p = at; for (let g = 0; g < s.bytes; g += GROUP) { const m = rom[p++]; for (let w = 0; w < 8; w++) if (!(m & (1 << w))) p += 2; } length = p - at; }
        return { id, at, length, compressed };
    });
}
function decodeAt(rom: Uint8Array, s: Spec, at: number, compressed: boolean): Uint8Array {
    if (!compressed) return rom.slice(at, at + s.bytes);
    const out = new Uint8Array(s.bytes);
    let p = at;
    for (let g = 0; g < s.bytes; g += GROUP) {
        const m = rom[p++];
        for (let w = 0; w < 8; w++) if (!(m & (1 << w))) { out[g + 2 * w] = rom[p]; out[g + 2 * w + 1] = rom[p + 1]; p += 2; }
    }
    return out;
}

interface Alias { bytes_of: string[]; compressed: boolean }
interface Built { items: Item[]; at: Map<string, { key: string; offset: number; compressed: boolean }> }

function blockCodec(s: Spec): Codec {
    const DIR = s.kind, TABLE = `${DIR}/_table`;
    const built = new WeakMap<ImplodeContext, Built>();
    const rule = { ...map.rule('sprite_blocks'), above: (s.base & 0x3F) << 16 };
    const png = (raw: Uint8Array) => new Uint8Array(encodeIndexedPng(s.size, s.size, pixelsOf(raw, s.size), GREY, ALPHA));
    const owners16or8 = s.size === 16 ? 16 : 8;
    let ownerOf = new Map<number, string>();
    return {
        kind: DIR, version: 2, path: DIR, folder: `sprites/${s.size === 16 ? 'blocks_16' : 'blocks_8'}`, nameRe: METASPRITE_NAME_RE,

        // `<owner>/<owner>_block_<id>` once explode knows the owners (the chain block → metasprite → animation → owner):
        // the leaf repeats the folder so a link or a tab title says whose block it is.
        defaultName: id => {
            const owner = ownerOf.get(id) ?? 'misc', leaf = `${owner}_block_${hex4(id)}`;
            return `${owner}/${leaf.length <= 80 ? leaf : `block_${hex4(id)}`}`;
        },

        // A PNG compares by its indices (its grey palette only shows them).
        canonical(path, bytes) {
            if (!path.endsWith('.png')) return [path, bytes];
            return [path.replace(/\.png$/, '.indices'), decodePng(bytes).indices ?? bytes];
        },

        explode(rom, name, _options, countOf, nameAt) {
            if (countOf(DIR) === undefined) ownerOf = blockOwners(rom, name, countOf, nameAt)[owners16or8];
            const table = tableAt(rom, s.readers, DIR), count = countOf(DIR) ?? s.vanilla, list = entries(rom, s, table, count);
            const files: Tree = new Map(), pool = [], homes = [];
            // Spans in byte order; a block overlapping the ones before it is an alias of the blocks it covers.
            const sorted = [...list].sort((a, b) => a.at - b.at || a.length - b.length || a.id - b.id);
            const members: typeof list = [], aliases: typeof list = [];
            let end = -1;
            for (const e of sorted) { if (e.at < end) aliases.push(e); else { members.push(e); end = e.at + e.length; } }
            const aliased = new Map<number, string[]>();
            for (const a of aliases) {
                const run = members.filter(m => m.at >= a.at && m.at < a.at + a.length);
                if (!run.length || run[0].at !== a.at || run[run.length - 1].at + run[run.length - 1].length !== a.at + a.length || run.some((m, k) => k && m.at !== run[k - 1].at + run[k - 1].length)) {
                    throw new Error(`${DIR}: block ${a.id} shares bytes with others in a way this codec does not know; explode would lose data`);
                }
                files.set(`${DIR}/${name(DIR, a.id)}.json`, json({ bytes_of: run.map(m => name(DIR, m.id)), compressed: a.compressed } satisfies Alias));
                for (const m of run) aliased.set(m.id, run.map(r => name(DIR, r.id)));
            }
            const placed = new Set<number>();
            for (const m of members) {
                const raw = decodeAt(rom, s, m.at, m.compressed), again = stored(raw);
                if (again.compressed !== m.compressed || sha1(again.bytes) !== sha1(rom.subarray(m.at, m.at + m.length))) throw new Error(`${DIR}: block ${m.id} is not stored as our encoder stores it; explode would lose data`);
                files.set(`${DIR}/${name(DIR, m.id)}.png`, png(raw));
                if (placed.has(m.id)) continue;
                // One item per block, or one per run an alias reads, keyed by its first block.
                const run = aliased.get(m.id)?.map(n => list.find(x => name(DIR, x.id) === n)!) ?? [m];
                run.forEach(r => placed.add(r.id));
                const from = run[0].at, to = run[run.length - 1].at + run[run.length - 1].length;
                pool.push({ start: from, end: to });
                homes.push({ key: `${DIR}/${name(DIR, run[0].id)}`, at: from, length: to - from, sha1: sha1(rom.subarray(from, to)) });
            }
            files.set(`${DIR}/${ENUM}`, enumFile({ kind: DIR, limit: LIMIT, names: list.map(e => name(DIR, e.id)), why: `the block table (${s.where}) is read with X = 3·id in 16 bits` }));
            pool.push({ start: table, end: table + 3 * count });
            homes.push({ key: TABLE, at: table, length: 3 * count, sha1: sha1(rom.subarray(table, table + 3 * count)) });
            return { files, pool, tables: readerSpans(s.readers), homes };
        },

        names({ tree, findings }) {
            const names = new Set<string>();
            for (const path of tree.keys()) {
                if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
                const m = new RegExp(`^${DIR}/((?:[^/_][^/]*/)?[^/_][^/]*)\\.(png|json)$`).exec(path);
                if (!m) { findings.warning('unknown-file', path, '', 'a block is <owner>/<name>.png (or an alias <name>.json); ignored'); continue; }
                if (names.has(m[1])) findings.error('duplicate-name', path, '', `"${m[1]}" is both a .png and a .json; keep one`);
                names.add(m[1]);
            }
            return names;
        },

        encode(ctx, names) {
            const { tree, findings } = ctx;
            const raw = new Map<string, Uint8Array>(), aliases = new Map<string, Alias>();
            for (const n of names) {
                const p = `${DIR}/${n}.png`, j = `${DIR}/${n}.json`;
                if (!METASPRITE_NAME_RE.test(n)) { findings.error('bad-name', tree.has(p) ? p : j, '', `"${n}": snake_case (or <owner>/<name>), at most 80 characters each`); continue; }
                if (tree.has(p)) {
                    let img: { width: number; height: number; indices?: Uint8Array };
                    try { img = decodePng(tree.get(p)!); } catch (e) { findings.error('parse-error', p, '', (e as Error).message); continue; }
                    if (!img.indices || img.width !== s.size || img.height !== s.size || img.indices.some(v => v > 15)) { findings.error('invalid-value', p, '', `an indexed PNG, ${s.size}×${s.size}, 16 colours: the indices are the block`); continue; }
                    raw.set(n, rawOf(img.indices, s.size));
                    continue;
                }
                let a: Alias;
                try { a = JSON.parse(readText(tree.get(j)!)); } catch (e) { findings.error('parse-error', j, '', (e as Error).message); continue; }
                if (!Array.isArray(a.bytes_of) || !a.bytes_of.length || typeof a.compressed !== 'boolean') { findings.error('invalid-value', j, '', '{ "bytes_of": [blocks…], "compressed": bool }: a block read from other blocks\' bytes'); continue; }
                aliases.set(n, a);
            }
            const items: Item[] = [], at = new Map<string, { key: string; offset: number; compressed: boolean }>(), inRun = new Set<string>();
            for (const [n, a] of aliases) {
                const j = `${DIR}/${n}.json`;
                const bad = a.bytes_of.find(m => !raw.has(m) || inRun.has(m));
                if (bad !== undefined) { findings.error(raw.has(bad) ? 'duplicate-name' : 'unknown-reference', j, '/bytes_of', `"${bad}" is ${raw.has(bad) ? 'in another alias\'s run' : 'no block .png here'}`); continue; }
                const parts = a.bytes_of.map(m => stored(raw.get(m)!)), bytes = new Uint8Array(parts.reduce((x, p) => x + p.bytes.length, 0));
                let o = 0;
                a.bytes_of.forEach((m, k) => { inRun.add(m); at.set(m, { key: `${DIR}/${a.bytes_of[0]}`, offset: o, compressed: parts[k].compressed }); bytes.set(parts[k].bytes, o); o += parts[k].bytes.length; });
                if (!a.compressed && bytes.length !== s.bytes) { findings.error('invalid-value', j, '/bytes_of', `these blocks are ${bytes.length} bytes stored; read raw, a block is ${s.bytes}`); continue; }
                at.set(n, { key: `${DIR}/${a.bytes_of[0]}`, offset: 0, compressed: a.compressed });
                items.push({ key: `${DIR}/${a.bytes_of[0]}`, file: j, bytes, rule });
            }
            for (const [n, r] of raw) {
                if (inRun.has(n)) continue;
                const st = stored(r);
                at.set(n, { key: `${DIR}/${n}`, offset: 0, compressed: st.compressed });
                items.push({ key: `${DIR}/${n}`, file: `${DIR}/${n}.png`, bytes: st.bytes, rule });
            }
            const count = Math.max(-1, ...(ctx.ids.get(DIR)?.values() ?? [])) + 1;
            items.push({ key: TABLE, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(3 * count), rule: { noCrossBank: true }, generated: true });
            built.set(ctx, { items, at });
            return items;
        },

        tables(ctx, placed) {
            const ids = ctx.ids.get(DIR), tableAt_ = placed.get(TABLE), b = built.get(ctx);
            if (!ids || tableAt_ === undefined || !b) return [];
            const count = Math.max(-1, ...ids.values()) + 1, table = new Uint8Array(3 * count), byId = new Map([...ids].map(([n, id]) => [id, n]));
            for (let id = 0; id < count; id++) {
                const n = byId.get(id), where = n === undefined ? undefined : b.at.get(n);
                if (n === undefined || !where) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no block has id ${id}; the table cannot skip one yet`); continue; }
                const f = placed.get(where.key)! + where.offset;
                table.set([f & 0xFF, (f >> 8) & 0xFF, ((f >> 16) - (s.base - 0xC0)) | (where.compressed ? 0x80 : 0)], 3 * id);
            }
            return [{ at: tableAt_, bytes: table, file: `${DIR}/${ENUM}` }, ...readerWrites(ctx, s.readers, tableAt_, `${DIR}/${ENUM}`)] satisfies Write[];
        },
    };
}

const SPEC_16: Spec = {
    kind: 'sprite_blocks_16', size: 16, bytes: 128, base: map.bank('sprite_blocks_16.base'), vanilla: 4854, where: '$EC:0000',
    readers: map.readers('sprite_blocks_16.table_readers'),
};
const SPEC_8: Spec = {
    kind: 'sprite_blocks_8', size: 8, bytes: 32, base: map.bank('sprite_blocks_8.base'), vanilla: 6265, where: '$D8:0000',
    readers: map.readers('sprite_blocks_8.table_readers'),
};

const blockTableCache = new WeakMap<Uint8Array, { large: number; small: number }>();

/** Decode one 16×16 or 8×8 sprite block from `rom`, following relocated block tables when moved. */
export function decodeSpriteBlockFromRom(rom: Uint8Array, id: number, large: boolean): { size: number; pixels: Uint8Array } | null {
    let tables = blockTableCache.get(rom);
    if (!tables) {
        tables = {
            large: tableAt(rom, SPEC_16.readers, SPEC_16.kind),
            small: tableAt(rom, SPEC_8.readers, SPEC_8.kind),
        };
        blockTableCache.set(rom, tables);
    }
    const s = large ? SPEC_16 : SPEC_8;
    const e = (large ? tables.large : tables.small) + 3 * id;
    if (e < 0 || e + 3 > rom.length) return null;
    const hi = rom[e + 2];
    const at = ((s.base - 0xC0 + (hi & 0x7F)) << 16) | rom[e] | (rom[e + 1] << 8);
    const compressed = (hi & 0x80) !== 0;
    if (at < 0 || at >= rom.length || (!compressed && at + s.bytes > rom.length)) return null;
    try {
        if (compressed) {
            let p = at;
            for (let g = 0; g < s.bytes; g += GROUP) {
                if (p >= rom.length) return null;
                const m = rom[p++];
                for (let w = 0; w < 8; w++) if (!(m & (1 << w))) p += 2;
            }
            if (p > rom.length) return null;
        }
        return { size: s.size, pixels: pixelsOf(decodeAt(rom, s, at, compressed), s.size) };
    } catch {
        return null;
    }
}

export const spriteBlocks16Codec = blockCodec(SPEC_16);
export const spriteBlocks8Codec = blockCodec(SPEC_8);
