// The `music` and `sounds` kinds (docs/open-evermore/resources.md §music and sounds).
//   music/<package>/package.json   what the sound driver's upload copies into audio RAM, in order: each transfer a
//                                  piece of data and its SPC address; for the reader the music and sound ids that
//                                  load this package
//   music/<package>/<data>.bin     the raw bytes those transfers read (sequences, instruments, samples: not decoded
//                                  yet); a piece several packages load lives in the first one's folder and the others
//                                  name it `<package>/<data>`
//   music/_enum.json               names[package id]: 0 the base (driver data and most sound effects), 1-70 the songs
//   sounds/<name>.json             a script sound id (opcode 0x30, animation opcode 0x2E): the driver's sound effect
//   sounds/_enum.json              names[script sound id]
// Implode writes every package's descriptor wherever it lands, the package pointers, and the sound id table.
//
// Facts used (src/games/evermore/rom/model/audio.ts, the spc-dumping notes in docs/todo/audio-and-music.md):
//   packages  $81:9900 the count - 1, $81:9903 a 24-bit pointer per package to its descriptor: [count:16] then
//             count × [length:16][source:24][spc address:16]. Read by `lda.l $819903,x`/`$819905,x` ($8C:8252) and
//             for package 0 at $8C:803D; the tables after the pointers ($81:99D8 music → package, $81:9A1E sound →
//             package) are found from the count ($8C:82A8), so the pointer table stays and holds 71
//   copies    descriptors and data are read on through upper halves: past $xx:FFFF the copy goes on at $xx+1:8000
//   sounds    $8C:8362: one word per script sound id, the driver's effect ($FFFF: none); 112 ids, in place
// Names: our music names (localizations/sounds.ts, package p plays music p - 1) and sound names (its ids are 2·id).
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item, Span, Window, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { piecesOf, windowFile, windowPos } from '../../layout.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { hexText, parseHex } from './readers.mts';

const require = createRequire(import.meta.url);
const { hiromFileOffset } = require('../../../../dist/platform/snes/hirom');
const sounds = require('../../../../dist/games/evermore/localizations/sounds');

export const MUSIC = 'music', SOUNDS = 'sounds';
const COUNT_AT = 0x019900, POINTERS = 0x019903, MUSIC_IDS = 0x0C8442, MUSIC_ID_COUNT = 73, PACKAGE_OF_MUSIC = 0x0199D8;
const SFX_PACKAGES = 0x019A1E, SFX_COUNT = 90, SOUND_TABLE = 0x0C8362, SOUND_COUNT = 112;
const PACKAGE = 'package.json';
/** Upper halves of the first 4 MiB, read as one space. */
const WINDOW: Window = { from: 0x00, to: 0x40 };
const HALF = 0x8000;
const hex2 = (v: number) => v.toString(16).padStart(2, '0');
const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const r16 = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8);
const r24 = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16);
const upper = (at: number) => (at & 0xFFFF) >= HALF;

/** `n` bytes from file offset `at` as the copy reads them: on through upper halves, or inside a lower half's bank. */
function read(rom: Uint8Array, at: number, n: number): Uint8Array {
    if (!upper(at)) return rom.slice(at, at + n);
    const out = new Uint8Array(n), p = windowPos(WINDOW, at);
    for (let k = 0; k < n; k++) out[k] = rom[windowFile(WINDOW, p + k)];
    return out;
}
/** File offset `n` bytes on from `at`, as the copy steps. */
const step = (at: number, n: number) => upper(at) ? windowFile(WINDOW, windowPos(WINDOW, at) + n) : at + n;

/** Package names: our music names; package 0 the base. */
function packageName(p: number): string {
    if (p === 0) return 'sound_base';
    const m = sounds.getMusic?.(p - 1);
    const n = m ? snake(m.name) : '';
    return NAME_RE.test(n) ? n : `package_${hex2(p)}`;
}
const SOUND_NAMES = new Map<number, string>();
for (let id = 0; id < SOUND_COUNT; id++) {
    const s = sounds.getSound?.(2 * id), n = s ? snake(s.name) : '';
    let name = NAME_RE.test(n) ? n : `sound_${hex2(id)}`;
    if ([...SOUND_NAMES.values()].includes(name)) name = `${name}_${hex2(id)}`;
    SOUND_NAMES.set(id, name);
}

interface Transfer { length: number; source: number; to: number }
/** Every package's descriptor and transfers, and the data pieces they read (overlapping reads merged). */
function layout(rom: Uint8Array, count: number) {
    const packages = Array.from({ length: count }, (_, p) => {
        const at = hiromFileOffset(r24(rom, POINTERS + 3 * p)), head = read(rom, at, 2), n = r16(head, 0);
        const body = read(rom, step(at, 2), 7 * n);
        const transfers: Transfer[] = Array.from({ length: n }, (_, k) => ({ length: r16(body, 7 * k), source: hiromFileOffset(r24(body, 7 * k + 2)), to: r16(body, 7 * k + 5) }));
        return { at, length: 2 + 7 * n, transfers };
    });
    // A piece's position: its window position (upper) or file offset (lower half, which the copy never leaves).
    type Piece = { space: 'w' | 'f'; start: number; end: number; first: number };
    const reads: Piece[] = [];
    packages.forEach((p, i) => p.transfers.forEach(t => {
        if (upper(t.source)) reads.push({ space: 'w', start: windowPos(WINDOW, t.source), end: windowPos(WINDOW, t.source) + t.length, first: i });
        else {
            if ((t.source >> 16) !== ((t.source + t.length - 1) >> 16)) throw new Error(`music: a transfer from a lower half crosses a bank at ${t.source.toString(16)}; explode would lose data`);
            reads.push({ space: 'f', start: t.source, end: t.source + t.length, first: i });
        }
    }));
    const pieces: Piece[] = [];
    for (const space of ['w', 'f'] as const) {
        for (const r of reads.filter(x => x.space === space).sort((a, b) => a.start - b.start || a.first - b.first)) {
            const last = pieces[pieces.length - 1];
            if (last && last.space === space && r.start < last.end) { last.end = Math.max(last.end, r.end); last.first = Math.min(last.first, r.first); }
            else pieces.push({ ...r });
        }
    }
    const fileOf = (pc: Piece) => pc.space === 'w' ? windowFile(WINDOW, pc.start) : pc.start;
    /** The piece a transfer reads and its offset in it. */
    const pieceOf = (t: Transfer) => {
        const pos = upper(t.source) ? windowPos(WINDOW, t.source) : t.source, space = upper(t.source) ? 'w' : 'f';
        const pc = pieces.find(x => x.space === space && pos >= x.start && pos + t.length <= x.end)!;
        return { piece: pc, offset: pos - pc.start };
    };
    return { packages, pieces, fileOf, pieceOf };
}

/** The holes a piece's file spans leave, so explode never takes bytes twice (descriptors among data). */
function spansOf(at: number, length: number): Span[] {
    return piecesOf({ bytes: new Uint8Array(length), rule: upper(at) ? { window: WINDOW } : {} }, at).map(p => ({ start: p.start, end: p.end }));
}

interface Encoded { descriptors: Map<string, { key: string; transfers: { piece: string; offset: number; length: number; to: number }[] }> }
const encoded = new WeakMap<ImplodeContext, Encoded>();

export const musicCodec: Codec = {
    kind: MUSIC, version: 1, path: MUSIC,

    defaultName: packageName,

    // package.json: the transfers are the package; which ids load it is derived for the reader.
    canonical(path, bytes) {
        if (!path.endsWith('/' + PACKAGE)) return [path, bytes];
        return [path, json({ transfers: JSON.parse(readText(bytes)).transfers })];
    },

    explode(rom, name, _options, countOf, nameAt) {
        const count = countOf(MUSIC) ?? rom[COUNT_AT] + 1;
        const L = layout(rom, count), files: Tree = new Map(), pool: Span[] = [], homes = [];
        const names = Array.from({ length: count }, (_, p) => name(MUSIC, p));
        // Each piece: named in its first package's folder (`data_<k>` in order of first use), or as the tree had it.
        const pieceName = new Map<object, string>(), perPackage = new Map<number, number>();
        L.packages.forEach(p => p.transfers.forEach(t => {
            const { piece } = L.pieceOf(t);
            if (pieceName.has(piece)) return;
            const k = (perPackage.get(piece.first) ?? 0) + 1;
            perPackage.set(piece.first, k);
            pieceName.set(piece, nameAt(MUSIC, L.fileOf(piece)) ?? `${names[piece.first]}/data_${k}`);
        }));
        const musicIds = new Map<number, number[]>(), sfx = new Map<number, number[]>();
        for (let i = 0; i < MUSIC_ID_COUNT; i++) { const m = r16(rom, MUSIC_IDS + 2 * i); if (m !== 0xFFFF) { const p = rom[PACKAGE_OF_MUSIC + m]; musicIds.set(p, [...(musicIds.get(p) ?? []), i]); } }
        for (let s = 0; s < SFX_COUNT; s++) { const p = rom[SFX_PACKAGES + s]; sfx.set(p, [...(sfx.get(p) ?? []), s]); }
        L.packages.forEach((p, i) => {
            const own = (full: string) => full.startsWith(names[i] + '/') ? full.slice(names[i].length + 1) : full;
            files.set(`${MUSIC}/${names[i]}/${PACKAGE}`, json({
                transfers: p.transfers.map(t => {
                    const { piece, offset } = L.pieceOf(t), whole = offset === 0 && t.length === piece.end - piece.start;
                    return { data: own(pieceName.get(piece)!), ...(whole ? {} : { offset, length: t.length }), to: hexText(t.to, 4) };
                }),
                music_ids: musicIds.get(i) ?? [], driver_sounds: sfx.get(i) ?? [],
            }));
            pool.push(...spansOf(p.at, p.length));
            // The descriptor's sha1 as encode gives it: the source pointers (patched in once the data is placed) as 0.
            const d = read(rom, p.at, p.length);
            for (let k = 0; k < p.transfers.length; k++) d.fill(0, 2 + 7 * k + 2, 2 + 7 * k + 5);
            homes.push({ key: `${MUSIC}/${names[i]}/_descriptor`, at: p.at, length: p.length, sha1: sha1(d) });
        });
        for (const piece of L.pieces) {
            const n = pieceName.get(piece)!, at = L.fileOf(piece), bytes = read(rom, at, piece.end - piece.start);
            files.set(`${MUSIC}/${n}.bin`, bytes);
            pool.push(...spansOf(at, bytes.length));
            homes.push({ key: `${MUSIC}/${n}`, at, length: bytes.length, sha1: sha1(bytes) });
        }
        files.set(`${MUSIC}/${ENUM}`, enumFile({ kind: MUSIC, limit: count, names, why: 'the package pointers at $81:9903; the tables after them are found from the count ($8C:82A8), so they stay and hold this many' }));
        return { files, pool, tables: [{ start: POINTERS, end: POINTERS + 3 * count }], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(MUSIC + '/') || path === `${MUSIC}/${ENUM}`) continue;
            const m = /^music\/([^/]+)\/([^/]+)$/.exec(path);
            if (m && m[2] === PACKAGE) names.add(m[1]);
            else if (!(m && m[2].endsWith('.bin'))) findings.warning('unknown-file', path, '', `a package is a folder with ${PACKAGE} and its .bin data; ignored`);
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx, ids = ctx.ids.get(MUSIC);
        const items: Item[] = [], pieces = new Map<string, Uint8Array>(), state: Encoded = { descriptors: new Map() };
        for (const path of tree.keys()) {
            const m = /^music\/([^/]+)\/([^/]+)\.bin$/.exec(path);
            if (m) pieces.set(`${m[1]}/${m[2]}`, tree.get(path)!);
        }
        if (ids && Math.max(-1, ...ids.values()) + 1 !== ctx.base.image[COUNT_AT] + 1) {
            findings.error('id-over-limit', `${MUSIC}/${ENUM}`, '/names', `${ctx.base.image[COUNT_AT] + 1} packages: the tables after the pointers are found from the count, so it cannot change yet`);
        }
        const used = new Set<string>();
        for (const n of names) {
            const path = `${MUSIC}/${n}/${PACKAGE}`;
            let v: { transfers?: { data?: unknown; offset?: unknown; length?: unknown; to?: unknown }[] };
            try { v = JSON.parse(readText(tree.get(path)!)); } catch (e) { findings.error('parse-error', path, '', (e as Error).message); continue; }
            if (!Array.isArray(v.transfers)) { findings.error('schema', path, '/transfers', 'a list of { data, to } (offset and length for part of a piece)'); continue; }
            const transfers: { piece: string; offset: number; length: number; to: number }[] = [];
            v.transfers.forEach((t, k) => {
                const p = `/transfers/${k}`, data = typeof t?.data === 'string' ? (t.data.includes('/') ? t.data : `${n}/${t.data}`) : '';
                const bytes = pieces.get(data), to = parseHex(t?.to, 0xFFFF);
                if (!bytes) { findings.error('unknown-reference', path, `${p}/data`, `"${t?.data}" is no .bin in this package's folder (or <package>/<data>)`); return; }
                if (to === null) { findings.error('invalid-value', path, `${p}/to`, '"$xxxx": the SPC address it is copied to'); return; }
                const offset = t.offset === undefined ? 0 : t.offset as number, length = t.length === undefined ? bytes.length - offset : t.length as number;
                if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 1 || offset + length > bytes.length || length > 0xFFFF) { findings.error('invalid-value', path, p, `offset and length inside the ${bytes.length} bytes of ${data}`); return; }
                used.add(data);
                transfers.push({ piece: data, offset, length, to });
            });
            const key = `${MUSIC}/${n}/_descriptor`;
            state.descriptors.set(n, { key, transfers });
            const bytes = new Uint8Array(2 + 7 * transfers.length);
            bytes.set([transfers.length & 0xFF, transfers.length >> 8]);
            transfers.forEach((t, k) => bytes.set([t.length & 0xFF, t.length >> 8, 0, 0, 0, t.to & 0xFF, t.to >> 8], 2 + 7 * k));
            const home = ctx.base.homes.get(key), crossed = home && (home.at >> 16) !== (windowFile(WINDOW, windowPos(WINDOW, home.at) + home.length - 1) >> 16);
            items.push({ key, file: path, bytes, rule: crossed ? { window: WINDOW, bankOffset: home!.at & 0xFFFF } : { upperHalf: true, noCrossBank: true, below: 0x400000 }, patched: true });
        }
        for (const [n, bytes] of pieces) {
            if (!used.has(n)) { findings.warning('left-out', `${MUSIC}/${n}.bin`, '', 'no package loads it: it is left out of the ROM'); continue; }
            const home = ctx.base.homes.get(`${MUSIC}/${n}`);
            // A piece the copy reads inside a lower half stays in one bank; the rest are read on through upper halves.
            // Crossing into the next bank costs the copy cycles, and the upload is paced by the SPC handshake: a piece
            // that did not cross in vanilla, or a new one, stays in one bank's upper half; the 22 that crossed keep
            // their offset in the bank, so they cross at the same byte.
            const crossed = home && upper(home.at) && (home.at >> 16) !== (windowFile(WINDOW, windowPos(WINDOW, home.at) + home.length - 1) >> 16);
            const rule = home && !upper(home.at) ? { noCrossBank: true, below: 0x400000 } : crossed ? { window: WINDOW, bankOffset: home.at & 0xFFFF } : { upperHalf: true, noCrossBank: true, below: 0x400000 };
            items.push({ key: `${MUSIC}/${n}`, file: `${MUSIC}/${n}.bin`, bytes, rule });
        }
        encoded.set(ctx, state);
        return items;
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(MUSIC), state = encoded.get(ctx);
        if (!ids || !state) return [];
        const writes: Write[] = [], table = new Uint8Array(3 * ids.size);
        const fileAt = (piece: string, offset: number) => { const at = placed.get(`${MUSIC}/${piece}`)!; return upper(at) ? windowFile(WINDOW, windowPos(WINDOW, at) + offset) : at + offset; };
        for (const [n, id] of ids) {
            const d = state.descriptors.get(n), at = d && placed.get(d.key);
            if (!d || at === undefined) continue;
            // Each transfer's source pointer, where the data landed.
            d.transfers.forEach((t, k) => {
                const src = ctx.pointer(fileAt(t.piece, t.offset));
                [src & 0xFF, (src >> 8) & 0xFF, src >> 16].forEach((b, j) => writes.push({ at: windowFile(WINDOW, windowPos(WINDOW, at) + 2 + 7 * k + 2 + j), bytes: Uint8Array.of(b), file: `${MUSIC}/${n}/${PACKAGE}` }));
            });
            const bus = ctx.pointer(at);
            table.set([bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16], 3 * id);
        }
        writes.push({ at: POINTERS, bytes: table, file: `${MUSIC}/${ENUM}` });
        return writes;
    },
};

export const soundsCodec: Codec = {
    kind: SOUNDS, version: 1, path: SOUNDS,

    defaultName: id => SOUND_NAMES.get(id) ?? `sound_${hex2(id)}`,

    canonical(path, bytes) {
        if (path === `${SOUNDS}/${ENUM}`) return [path, bytes];
        return [path, json({ sfx: JSON.parse(readText(bytes)).sfx })];
    },

    explode(rom, name) {
        const files: Tree = new Map(), names: string[] = [];
        for (let id = 0; id < SOUND_COUNT; id++) {
            const n = name(SOUNDS, id), v = r16(rom, SOUND_TABLE + 2 * id);
            names.push(n);
            files.set(`${SOUNDS}/${n}.json`, json(v === 0xFFFF ? { sfx: null } : { sfx: v, package: name(MUSIC, rom[SFX_PACKAGES + v] ?? 0) }));
        }
        files.set(`${SOUNDS}/${ENUM}`, enumFile({ kind: SOUNDS, limit: SOUND_COUNT, names, why: 'the sound id table at $8C:8362 (opcode 0x30 and animation opcode 0x2E index it) holds 112; it stays where it is' }));
        return { files, pool: [], tables: [{ start: SOUND_TABLE, end: SOUND_TABLE + 2 * SOUND_COUNT }], homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(SOUNDS + '/') || path === `${SOUNDS}/${ENUM}`) continue;
            const m = /^sounds\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a sound is one <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        for (const n of names) {
            const path = `${SOUNDS}/${n}.json`;
            let v: { sfx?: unknown };
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            if (v.sfx !== null && !(Number.isInteger(v.sfx) && (v.sfx as number) >= 0 && (v.sfx as number) < 0xFFFF)) ctx.findings.error('invalid-value', path, '/sfx', 'the driver\'s sound effect number, or null for none');
        }
        return [];
    },

    tables(ctx) {
        const ids = ctx.ids.get(SOUNDS);
        if (!ids) return [];
        const table = new Uint8Array(2 * SOUND_COUNT).fill(0xFF);
        for (const [n, id] of ids) {
            if (id >= SOUND_COUNT) continue;
            const v = JSON.parse(readText(ctx.tree.get(`${SOUNDS}/${n}.json`)!)).sfx;
            if (v !== null) table.set([v & 0xFF, v >> 8], 2 * id);
        }
        return [{ at: SOUND_TABLE, bytes: table, file: `${SOUNDS}/${ENUM}` }];
    },
};
