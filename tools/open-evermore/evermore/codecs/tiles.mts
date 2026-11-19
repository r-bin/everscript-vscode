// The `tiles` kind (docs/open-evermore/resources.md §tiles): the 16×16 map graphics, one file per tile, reached
// only through the pointer table implode writes. A tile is `<name>.png` by default (owner, 2026-11-19): indexed, 16
// entries, index 0 transparent; the indices are the tile, the colours only show it (the family vanilla draws it with
// most). `explode --tiles json` writes `<name>.json` with 16 rows of hex digits instead. `_encoded.json` keeps the
// vanilla bytes of the six tiles our encoder does not reproduce.
//
// Facts used (docs/map-format/map_tile_graphics_decompression.md, checked in VRAM 2026-11-19):
//   table      one 24-bit pointer per id, vanilla 6,688 at $EE0000 (file 0x2E0000), read by six long operands:
//              $8C:C898 (+0), $8C:C8A1 (+2), $90:A16A (+1), $90:A170 (+0), $90:A237 (+1), $90:A23D (+0) (lda.l
//              $EE000n,x with x = id·3). Census 2026-11-20: every long operand into $EE0000-$EE0004 in the ROM is one of
//              these or recorded as data by the vanilla CDL, and no immediate builds an $EE pointer. A generated item:
//              in place while the ids fit it, moved with the six operands once tiles are added; 21,845 ids (x is 16 bits)
//   pointer    a graphic in a bank's upper half has the $80-$BF form, in the lower half the $C0-$FF form
//   graphic    encoded by `encodeTile` (src/games/evermore/maps/chr.ts), which gives back 6,682 of the vanilla
//              graphics; the six in bit-6 form keep their bytes (`_encoded.json`: encoded). Two of those (run form)
//              make the game fetch three bytes past their own end, from the graphic stored after them
//              (`followedBy`): implode places the pair as one item while both still give their pixels
//   placement  never across a bank (the loader and the streamer read through DMA, whose source stays in its bank);
//              an animation frame (marked `dma` by the maps kind) is stored as 64 raw words, since the streamer
//              $90:A1B4 DMAs 128 bytes from +1
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { Findings } from '../../findings.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { familyColours } from './tile-families.mts';
import { roomBlobs } from './maps.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');
const { decodePng, encodeIndexedPng } = require('../../../../dist/platform/png');

export const KIND = 'tiles';
const DIR = KIND, VANILLA = 6688, LIMIT = 0x10000 / 3 | 0, TABLE = `${DIR}/_table`;
const READERS = [{ at: 0x0CC899, add: 0 }, { at: 0x0CC8A2, add: 2 }, { at: 0x10A16B, add: 1 }, { at: 0x10A171, add: 0 }, { at: 0x10A238, add: 1 }, { at: 0x10A23E, add: 0 }];

/** The table (file offset), through its readers' operands. */
function tableOf(rom: Uint8Array): number {
    const ops = READERS.map(r => maps.romFileOffset(rom, ((rom[r.at] | rom[r.at + 1] << 8 | rom[r.at + 2] << 16) - r.add) & 0xFFFFFF));
    if (READERS.some(r => rom[r.at - 1] !== 0xBF) || ops.some(o => o !== ops[0])) throw new Error('tiles: the table readers are not the ones this codec knows ($8C:C898, $90:A16A, $90:A237); another release?');
    return ops[0];
}
const FORMAT = 'open-evermore/tile', VERSION = 1, ENCODED = '_encoded.json';
/** Index 0 is transparent on a SNES background. */
const ALPHA = [0, ...Array(15).fill(255)];
const GREY = Array.from({ length: 16 }, (_, i) => [i * 17, i * 17, i * 17]);

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Every graphic an animation channel shows, in any room (the streamer DMAs them raw). */
function animationFrames(rom: Uint8Array, blobs: number[]): Set<number> {
    const frames = new Set<number>();
    for (const [id, at] of blobs.entries()) {
        const m = maps.modelFromRom(rom, id, at), d: Uint8Array = m.section2Data;
        for (let c = 0; c < m.section2Count; c++) {
            const count = d[c * 4 + 1], offset = d[c * 4 + 2] | (d[c * 4 + 3] << 8);
            for (let k = 0; k < count; k++) frames.add(d[offset + k * 3 + 1] | (d[offset + k * 3 + 2] << 8));
        }
    }
    return frames;
}

/** The family each tile is drawn with most in vanilla (from every room's metatile words), for its PNG's colours. */
function displayFamilies(rom: Uint8Array, blobs: number[]): Map<number, number> {
    const counts = new Map<number, Map<number, number>>();
    const add = (tile: number, family: number | undefined) => {
        if (family === undefined) return;
        const c = counts.get(tile) ?? new Map<number, number>();
        c.set(family, (c.get(family) ?? 0) + 1);
        counts.set(tile, c);
    };
    for (const [id, at] of blobs.entries()) {
        const d = maps.decodeRoom(rom, id, at);
        const slots: number[] = [...d.tilePalette, ...d.animatedTiles];
        const bySlot = new Map<number, number>();
        for (const w of [...d.metatileSlices.layer1, ...d.metatileSlices.layer2]) {
            const pal = (w >> 10) & 7, slot = maps.wordSlot(w);
            if (pal === 0 || slots[slot] === undefined) continue;
            add(slots[slot], d.tileFamilies[pal - 1]);
            bySlot.set(slot, d.tileFamilies[pal - 1]);
        }
        d.animation.forEach((ch: { frames: { tileId: number }[] }, c: number) => { for (const f of ch.frames) add(f.tileId, bySlot.get(d.tilePalette.length + c)); });
    }
    const out = new Map<number, number>();
    for (const [tile, c] of counts) out.set(tile, [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
    return out;
}

/** A tile file → 256 palette indices, or a finding. */
function readPixels(path: string, bytes: Uint8Array, findings: import('../../findings.mts').Findings): number[] | null {
    if (path.endsWith('.png')) {
        let img: { width: number; height: number; indices?: Uint8Array };
        try { img = decodePng(bytes); }
        catch (e) { findings.error('parse-error', path, '', (e as Error).message); return null; }
        if (!img.indices) { findings.error('invalid-value', path, '', 'an indexed PNG (16 palette entries): the indices are the tile'); return null; }
        if (img.width !== 16 || img.height !== 16) { findings.error('invalid-value', path, '', `${img.width}×${img.height}; a tile is 16×16`); return null; }
        const bad = img.indices.findIndex(i => i > 15);
        if (bad >= 0) { findings.error('invalid-value', path, '', `pixel ${bad % 16},${bad >> 4} uses palette entry ${img.indices[bad]}; a tile has 16`); return null; }
        return Array.from(img.indices);
    }
    let v: any;
    try { v = JSON.parse(readText(bytes)); }
    catch (e) { findings.error('parse-error', path, '', (e as Error).message); return null; }
    if (v?.format !== FORMAT || v?.version !== VERSION) { findings.error('schema', path, '/format', `"${FORMAT}", version ${VERSION}`); return null; }
    if (!Array.isArray(v.pixels) || v.pixels.length !== 16) { findings.error('invalid-value', path, '/pixels', '16 rows'); return null; }
    const bad = v.pixels.findIndex((r: unknown) => typeof r !== 'string' || !/^[0-9a-f]{16}$/.test(r));
    if (bad >= 0) { findings.error('invalid-value', path, `/pixels/${bad}`, '16 palette indices, one hex digit each (0-f)'); return null; }
    return v.pixels.flatMap((r: string) => [...r].map(c => parseInt(c, 16)));
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

    canonical: (path, bytes) => {
        const m = /^(.*)\.(png|json)$/.exec(path);
        if (!m || path.endsWith(ENCODED) || path.endsWith(ENUM)) return [path, bytes];
        const px = readPixels(path, bytes, new Findings());
        return [m[1] + '.tile', px ? Uint8Array.from(px) : bytes];
    },

    explode(rom, name, options, countOf) {
        const format = options.format ?? 'png';
        if (format !== 'png' && format !== 'json') throw new Error(`tiles: format "${format}"; png or json`);
        const table = tableOf(rom), count = countOf(KIND) ?? VANILLA;
        const blobs = roomBlobs(rom, countOf('maps'));
        const frames = animationFrames(rom, blobs);
        const colours = familyColours(rom, blobs), shown = format === 'png' ? displayFamilies(rom, blobs) : new Map<number, number>();
        const encoded: Record<string, { encoded: string; followedBy?: string }> = {};
        const at = Array.from({ length: count }, (_, id) => maps.romFileOffset(rom, rom[table + 3 * id] | rom[table + 3 * id + 1] << 8 | rom[table + 3 * id + 2] << 16) as number);
        const starts = [...at].sort((a, b) => a - b);
        const nextStart = (a: number) => { const i = starts.findIndex(s => s > a); return i < 0 ? Infinity : starts[i]; };
        const files: Tree = new Map();
        const names: string[] = [];
        const own: { start: number; end: number; follower: number }[] = [];
        for (let id = 0; id < count; id++) {
            const { bytes, end } = maps.decodeTile(rom, at[id]);
            const next = nextStart(at[id]);
            const stored = Math.min(end, next);
            const n = name(KIND, id);
            names.push(n);
            if (!same(maps.encodeTile(bytes, frames.has(id)), rom.subarray(at[id], end)) || stored < end) {
                encoded[n] = { encoded: hex(rom.subarray(at[id], stored)), ...(stored < end ? { followedBy: name(KIND, at.indexOf(next)) } : {}) };
            }
            own.push({ start: at[id], end: stored, follower: stored < end ? at.indexOf(next) : -1 });
            if (format === 'png') {
                const family = shown.get(id);
                const palette = family === undefined ? GREY : colours[family];
                files.set(`${DIR}/${n}.png`, new Uint8Array(encodeIndexedPng(16, 16, maps.decodeTilePixels(bytes), palette, ALPHA)));
            } else {
                files.set(`${DIR}/${n}.json`, json({ format: FORMAT, version: VERSION, pixels: toRows(bytes) }));
            }
        }
        if (Object.keys(encoded).length) files.set(`${DIR}/${ENCODED}`, json(encoded));
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: KIND, limit: LIMIT, names,
            why: 'the readers index the pointer table with id·3 in 16 bits; past the vanilla 6,688 the table moves',
        }));
        const followers = new Set(own.map(o => o.follower).filter(f => f >= 0));
        const homes = [];
        for (let id = 0; id < count; id++) {
            if (followers.has(id)) continue;
            const o = own[id];
            const end = o.follower >= 0 ? own[o.follower].end : o.end;
            homes.push({ key: `${DIR}/${names[id]}`, at: o.start, length: end - o.start, sha1: sha1(rom.subarray(o.start, end)) });
        }
        homes.push({ key: TABLE, at: table, length: count * 3, sha1: sha1(rom.subarray(table, table + count * 3)) });
        return { files, pool: [...own.map(o => ({ start: o.start, end: o.end })), { start: table, end: table + count * 3 }], tables: READERS.map(r => ({ start: r.at, end: r.at + 3 })), homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}` || path === `${DIR}/${ENCODED}`) continue;
            const m = /^tiles\/([^/]+)\.(png|json)$/.exec(path);
            if (!m) { findings.warning('unknown-file', path, '', 'a tile is one <name>.png or <name>.json; ignored'); continue; }
            if (names.has(m[1])) findings.error('duplicate-name', path, '', `"${m[1]}" is both a .png and a .json; keep one`);
            names.add(m[1]);
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx;
        const ids = ctx.ids.get(KIND);
        if (!ids) return [];
        interface Tile { bytes: Uint8Array; encoded?: Uint8Array; followedBy?: string; file: string; out?: Uint8Array }
        const tiles = new Map<string, Tile>();
        const encFile = `${DIR}/${ENCODED}`;
        let kept: Record<string, any> = {};
        if (tree.has(encFile)) {
            try { kept = JSON.parse(readText(tree.get(encFile)!)); }
            catch (e) { findings.error('parse-error', encFile, '', (e as Error).message); }
        }
        for (const n of [...names].sort()) {
            const png = tree.has(`${DIR}/${n}.png`), file = `${DIR}/${n}.${png ? 'png' : 'json'}`;
            if (!NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            const px = readPixels(file, tree.get(file)!, findings);
            if (!px) continue;
            const t: Tile = { bytes: maps.encodeTilePixels(px), file };
            const k = kept[n];
            if (k?.encoded !== undefined) {
                if (typeof k.encoded !== 'string' || !/^([0-9a-f]{2})+$/.test(k.encoded)) { findings.error('invalid-value', encFile, `/${n}/encoded`, 'hex bytes'); continue; }
                t.encoded = new Uint8Array(Buffer.from(k.encoded, 'hex'));
            }
            if (k?.followedBy !== undefined) {
                if (!names.has(k.followedBy)) { findings.error('unknown-reference', encFile, `/${n}/followedBy`, `no tile "${k.followedBy}" in ${DIR}/`); continue; }
                t.followedBy = k.followedBy;
            }
            if (!ctx.marks.get(`${DIR}/${n}`)?.has('used')) findings.warning('unreferenced', file, '', 'no map uses this tile');
            tiles.set(n, t);
        }
        // Each tile on its own: its vanilla bytes while they still give its pixels, else our encoder.
        const reencoded = (t: Tile) => findings.info('reencoded', t.file, '', `the bytes ${ENCODED} keeps no longer give these pixels; encoded anew`);
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
        const listed = ctx.ids.get(KIND);
        const count = listed && listed.size ? Math.max(...listed.values()) + 1 : 0;
        items.push({ key: TABLE, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(count * 3), rule: { noCrossBank: true }, generated: true });
        return items;
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(KIND);
        if (!ids) return [];
        const pairOf = pairs.get(ctx) ?? new Map();
        const tableAt = placed.get(TABLE);
        if (tableAt === undefined) return [];
        const bytes = new Uint8Array((Math.max(0, ...ids.values()) + 1) * 3);
        for (const [n, id] of ids) {
            const p = pairOf.get(n);
            const at = p ? placed.get(p.key)! + p.offset : placed.get(`${DIR}/${n}`);
            if (at === undefined) continue;
            const bus = ctx.pointer(at);
            bytes.set([bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16], id * 3);
        }
        const operand = (r: { add: number }) => { const bus = ctx.pointer(tableAt) + r.add; return Uint8Array.of(bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16); };
        return [{ at: tableAt, bytes, file: `${DIR}/${ENUM}` }, ...READERS.map(r => ({ at: r.at, bytes: operand(r), file: `${DIR}/${ENUM}` }))];
    },
};
