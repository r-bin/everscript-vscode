// The `strings` kind (docs/open-evermore/resources.md §strings): every in-game string as strings/<name>.txt, reached
// only through the string key table implode writes. Scripts and code name a string by its key (id·3), so the ids
// in strings/_enum.json are what they see; the bytes may go anywhere a key can point.
//
// Facts used (docs/disassembly/ui/dialogue-text-decoder.md, corrected 2026-11-19; asm $8C:CD33):
//   key table  3 bytes per id, vanilla 3,002 at $91:D000 (file 0x11D000). Read by $8C:CCF5 and its twin $8C:CD35:
//              `sta $26` (the key, id·3), `lda #$0091 : sta $28 : ldy #$D000`, `lda [$26],y`: the bank and the offset
//              are immediates (at $8C:CCF8 / $8C:CCFD and $8C:CD36 / $8C:CD3B) and the key adds to the offset, carrying
//              into the next bank. A generated item: in place while the ids fit it, moved with the four immediates
//              once strings are added, never across a bank: 21,845 ids. Entry: bits 0-14 the address in a bank's lower
//              half, bits 15-22 the bank above $C0, bit 23 compressed
//   placement  a string starts in a lower half ($C0-$FF:0000-$7FFF) of the first 4 MB and never crosses a bank
//              (the decoder steps a 16-bit pointer); vanilla fills $C0-$C3
//   plain      144 strings: bytes up to a 0; the resolver hands out their address
//   compressed 2,858 strings, decoded at $8C:CD84 with the tables in bank $91 (they stay in _base/): $00-$3F a
//              character ($91:F3AE; the one that maps to 0 ends the string), $40-$7F a literal run of n bytes,
//              $80-$BF a character pair ($91:F32E), $C0 n a phrase ($91:F46C → $91:F7D5), $C1-$FF a word
//              ($91:F3EC → $91:F66C; token $C1 is word 1, not a phrase: the older doc had it wrong). A 0 byte
//              follows every compressed string
//   encoding   our encoder takes the fewest bytes; vanilla's choices are not reproduced yet (ours matches 701 of
//              2,858 and is shorter for 1,001), so `_strings.json` keeps the vanilla bytes of the others while they
//              still give their text
import { createRequire } from 'node:module';
import type { Codec, Item, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1, text } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const { romFileOffset } = require('../../../../dist/games/evermore/maps');

export const KIND = 'strings';
const DIR = KIND, VANILLA = 3002, LIMIT = 0x10000 / 3 | 0, META = '_strings.json', TABLE = `${DIR}/_table`;
/** `lda #$0091 : sta $28 : ldy #$D000` in both readers: the bank immediate at +1, the offset at +6. */
const SITES = [0x0CCCF7, 0x0CCD35], SITE = [0xA9, -1, 0x00, 0x85, 0x28, 0xA0, -1, -1];

/** The key table (file offset), from the first reader's immediates. */
function tableOf(rom: Uint8Array): number {
    const bus = (at: number) => (rom[at + 1] << 16) | rom[at + 6] | (rom[at + 7] << 8);
    if (SITES.some(at => SITE.some((b, i) => b >= 0 && rom[at + i] !== b)) || bus(SITES[0]) !== bus(SITES[1])) throw new Error('strings: the key table readers are not the ones this codec knows ($8C:CCF5, $8C:CD35); another release?');
    return romFileOffset(rom, bus(SITES[0]));
}
const FORMAT = 'open-evermore/strings', VERSION = 1;
const RULE = { lowerHalf: true, noCrossBank: true, below: 0x400000 };
// The dictionary, in bank $91 (file offsets).
const SINGLES = 0x11F3AE, PAIRS = 0x11F32E, WORD_OFFSETS = 0x11F3EC, WORDS = 0x11F66C, PHRASE_OFFSETS = 0x11F46C, PHRASES = 0x11F7D5;

interface Dictionary { singles: number[]; pairs: number[][]; words: number[][]; phrases: number[][] }

function dictionary(rom: Uint8Array): Dictionary {
    const u16 = (at: number) => rom[at] | (rom[at + 1] << 8);
    const cstr = (at: number) => { const out: number[] = []; for (let c; (c = rom[at]); at++) out.push(c); return out; };
    return {
        singles: Array.from({ length: 64 }, (_, i) => rom[SINGLES + i]),
        pairs: Array.from({ length: 64 }, (_, i) => [rom[PAIRS + i * 2], rom[PAIRS + i * 2 + 1]]),
        words: Array.from({ length: 64 }, (_, i) => i === 0 ? [] : cstr(WORDS + u16(WORD_OFFSETS + i * 2))),
        phrases: Array.from({ length: 256 }, (_, i) => cstr(PHRASES + u16(PHRASE_OFFSETS + i * 2))),
    };
}

/** The string at `at` as the game reads it: its bytes, and one past the last byte it occupies. */
function decode(buf: Uint8Array, at: number, compressed: boolean, d: Dictionary): { out: number[]; end: number } {
    const out: number[] = [];
    let p = at;
    if (!compressed) { while (buf[p]) out.push(buf[p++]); return { out, end: p + 1 }; }
    for (let run = 0; ; p++) {
        const b = buf[p];
        if (run) { run--; if (!b && !run) break; out.push(b); }
        else if (b === 0xC0) out.push(...d.phrases[buf[++p]]);
        else if ((b & 0xC0) === 0xC0) out.push(...d.words[b & 0x3F]);
        else if ((b & 0xC0) === 0x40) run = b & 0x3F;
        else if ((b & 0xC0) === 0x80) { const [x, y] = d.pairs[b & 0x3F]; out.push(x); if (!y) break; out.push(y); }
        else { if (!d.singles[b]) break; out.push(d.singles[b]); }
    }
    return { out, end: p + 2 };   // the ending token, then the 0 every compressed string has
}

/** The fewest bytes that decode to `t` (dynamic programming over every token that fits), ending as vanilla does. */
function encode(t: number[], d: Dictionary): Uint8Array {
    const n = t.length, best = new Array<number>(n + 1).fill(Infinity), pick: number[][] = new Array(n + 1);
    const at = (p: number, s: number[]) => s.length > 0 && p + s.length <= n && s.every((c, i) => t[p + i] === c);
    const end = d.singles.indexOf(0);
    best[n] = 0;
    for (let p = n - 1; p >= 0; p--) {
        const opts: { cost: number; len: number; bytes: number[]; k: number }[] = [];
        const add = (len: number, bytes: number[], k: number) => opts.push({ cost: bytes.length + best[p + len], len, bytes, k });
        d.phrases.forEach((s, i) => { if (at(p, s)) add(s.length, [0xC0, i], 0); });
        d.words.forEach((s, i) => { if (i > 0 && at(p, s)) add(s.length, [0xC0 | i], 1); });
        d.pairs.forEach(([x, y], i) => { if (y && t[p] === x && t[p + 1] === y) add(2, [0x80 | i], 2); });
        d.singles.forEach((c, i) => { if (c && t[p] === c) add(1, [i], 3); });
        for (let len = 1; len <= 63 && p + len <= n; len++) add(len, [0x40 | len, ...t.slice(p, p + len)], 4);
        opts.sort((a, b) => a.cost - b.cost || a.k - b.k || b.len - a.len);
        best[p] = opts[0].cost;
        pick[p] = [opts[0].len, ...opts[0].bytes];
    }
    const out: number[] = [];
    for (let p = 0; p < n;) { const [len, ...bytes] = pick[p]; out.push(...bytes); p += len; }
    out.push(end, 0);
    return Uint8Array.from(out);
}

// ── The text form: lossless, one string per file ───────────────────────────────────────────────────────────────
// $0A is a line break; control bytes are tags ([BOY], [PAUSE:3d]: $80 nn $80); the font's special glyphs are
// … ‘ ’ → ←; "[" is written "[["; any other byte "[0xNN]".
const TAGS: Record<number, string> = {
    0x81: 'BOY', 0x82: 'DOG', 0x83: 'P3', 0x84: 'P4', 0x86: 'B', 0x87: 'PAGE', 0x8a: 'CHOICE_RIGHT', 0x8b: 'CHOICE_INLINE',
    0x8f: 'NOP', 0x90: 'BOLD', 0x91: 'UNBOLD', 0x92: 'CENTER', 0x93: 'LEFT', 0x94: 'RIGHT', 0x95: 'REPEAT', 0x96: 'SLOW',
    0x97: 'UNSLOW', 0x98: 'INVERTED', 0xa1: 'MEM1', 0xa2: 'MEM2', 0xa3: 'MEM3', 0x7e: 'OK',
};
const GLYPHS: Record<number, string> = { 0x5f: '…', 0x7b: '‘', 0x7d: '’', 0x5e: '→', 0x7f: '←' };
const BY_TAG = new Map(Object.entries(TAGS).map(([b, t]) => [t, +b]));
const BY_GLYPH = new Map(Object.entries(GLYPHS).map(([b, g]) => [g, +b]));

export function toText(raw: number[]): string {
    let s = '';
    for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (c === 0x80 && raw[i + 2] === 0x80 && i + 2 < raw.length) { s += `[PAUSE:${raw[i + 1].toString(16).padStart(2, '0')}]`; i += 2; }
        else if (c === 0x0a) s += '\n';
        else if (c === 0x5b) s += '[[';
        else if (TAGS[c]) s += `[${TAGS[c]}]`;
        else if (GLYPHS[c]) s += GLYPHS[c];
        else if (c >= 0x20 && c < 0x7f) s += String.fromCharCode(c);
        else s += `[0x${c.toString(16).padStart(2, '0')}]`;
    }
    return s;
}

/** Text → bytes, or the first thing that is not text of this form. */
export function fromText(s: string): number[] | string {
    const out: number[] = [];
    for (let i = 0; i < s.length;) {
        const c = s[i];
        if (c === '\n') { out.push(0x0a); i++; continue; }
        if (c === '[') {
            if (s[i + 1] === '[') { out.push(0x5b); i += 2; continue; }
            const m = /^\[(?:PAUSE:([0-9a-f]{2})|0x([0-9a-f]{2})|([A-Z0-9_]+))\]/.exec(s.slice(i));
            if (!m) return `"${s.slice(i, i + 12)}": a tag ([BOY], [PAUSE:3d], [0x9c]) or "[[" for "["`;
            if (m[1]) out.push(0x80, parseInt(m[1], 16), 0x80);
            else if (m[2]) out.push(parseInt(m[2], 16));
            else if (BY_TAG.has(m[3])) out.push(BY_TAG.get(m[3])!);
            else return `[${m[3]}]: no such tag (${Object.values(TAGS).join(', ')})`;
            i += m[0].length;
            continue;
        }
        const g = BY_GLYPH.get(c);
        if (g !== undefined) { out.push(g); i++; continue; }
        const code = c.charCodeAt(0);
        if (code < 0x20 || code >= 0x7f) return `"${c}" (U+${code.toString(16).padStart(4, '0')}): the font has ASCII, … ‘ ’ → ←, and [0xNN] for the rest`;
        out.push(code);
        i++;
    }
    if (out.includes(0)) return 'a 0 byte ends a string; it cannot be inside one';
    return out;
}
// A file ends with one line break that is not part of the string.
const fileText = (raw: number[]) => text(toText(raw) + '\n');
const readFile = (b: Uint8Array) => readText(b).replace(/\r\n/g, '\n').replace(/\n$/, '');

/** Where the string table entries point, and each key's flag. */
function readKeys(rom: Uint8Array, count: number): { at: number; compressed: boolean }[] {
    const table = tableOf(rom);
    return Array.from({ length: count }, (_, i) => {
        const v = rom[table + i * 3] | (rom[table + i * 3 + 1] << 8) | (rom[table + i * 3 + 2] << 16);
        return { at: (v & 0x7FFF) | (((v >> 15) & 0xFF) << 16), compressed: (v & 0x800000) !== 0 };
    });
}

export const stringsCodec: Codec = {
    kind: KIND, version: 1, path: DIR,

    defaultName: id => 'string_' + id.toString(16).padStart(4, '0'),

    canonical(path, bytes) {
        if (path.endsWith('.txt')) return [path, text(readFile(bytes))];
        if (path.endsWith('/' + META)) { const v = JSON.parse(readText(bytes)); delete v.encoded; return [path, json(v)]; }
        return [path, bytes];
    },

    explode(rom, name, _options, countOf) {
        const count = countOf(KIND) ?? VANILLA;
        const d = dictionary(rom), table = tableOf(rom), keys = readKeys(rom, count);
        const files: Tree = new Map(), names: string[] = [], plain: string[] = [], encoded: Record<string, string> = {};
        const pool = [], homes = [];
        for (let id = 0; id < count; id++) {
            const { at, compressed } = keys[id];
            const { out, end } = decode(rom, at, compressed, d);
            const n = name(KIND, id);
            names.push(n);
            const back = fromText(toText(out));
            if (typeof back === 'string' || back.length !== out.length || back.some((x, i) => x !== out[i])) throw new Error(`string ${id}: its text does not give its bytes back; explode would lose data`);
            files.set(`${DIR}/${n}.txt`, fileText(out));
            const bytes = rom.subarray(at, end);
            if (!compressed) plain.push(n);
            else if (sha1(encode(out, d)) !== sha1(bytes)) encoded[n] = Buffer.from(bytes).toString('base64');
            pool.push({ start: at, end });
            homes.push({ key: `${DIR}/${n}`, at, length: end - at, sha1: sha1(bytes) });
        }
        files.set(`${DIR}/${META}`, json({ format: FORMAT, version: VERSION, plain, encoded }));
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: KIND, limit: LIMIT, names,
            why: 'scripts name a string by its key, id·3, which the readers add to the table\'s offset in one bank; past the vanilla 3,002 the table moves',
        }));
        pool.push({ start: table, end: table + count * 3 });
        homes.push({ key: TABLE, at: table, length: count * 3, sha1: sha1(rom.subarray(table, table + count * 3)) });
        return { files, pool, tables: SITES.flatMap(at => [{ start: at + 1, end: at + 2 }, { start: at + 6, end: at + 8 }]), homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}` || path === `${DIR}/${META}`) continue;
            const m = /^strings\/([^/]+)\.txt$/.exec(path);
            if (m) names.add(m[1]);
            else findings.warning('unknown-file', path, '', 'a string is one <name>.txt; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx;
        const d = dictionary(ctx.base.image);
        const metaFile = `${DIR}/${META}`;
        let meta: any = { plain: [], encoded: {} };
        if (tree.has(metaFile)) {
            try { meta = JSON.parse(readText(tree.get(metaFile)!)); }
            catch (e) { findings.error('parse-error', metaFile, '', (e as Error).message); }
        }
        const plain = new Set<string>(Array.isArray(meta.plain) ? meta.plain : []);
        const items: Item[] = [];
        for (const n of [...names].sort()) {
            const file = `${DIR}/${n}.txt`;
            if (!NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            const raw = fromText(readFile(tree.get(file)!));
            if (typeof raw === 'string') { findings.error('invalid-value', file, '', raw); continue; }
            let bytes: Uint8Array;
            if (plain.has(n)) bytes = Uint8Array.from([...raw, 0]);
            else {
                const kept = typeof meta.encoded?.[n] === 'string' ? new Uint8Array(Buffer.from(meta.encoded[n], 'base64')) : null;
                const k = kept && decode(kept, 0, true, d);
                if (k && k.end === kept!.length && k.out.length === raw.length && k.out.every((x, i) => x === raw[i])) bytes = kept!;
                else {
                    if (kept) findings.info('reencoded', file, '', `the bytes ${META} keeps no longer give this text; encoded anew`);
                    bytes = encode(raw, d);
                }
            }
            if (bytes.length > 0x8000) { findings.error('over-budget', file, '', `${bytes.length} bytes; a string stays in one bank`); continue; }
            items.push({ key: `${DIR}/${n}`, file, bytes, rule: RULE });
        }
        const listed = ctx.ids.get(KIND);
        const count = listed && listed.size ? Math.max(...listed.values()) + 1 : 0;
        items.push({ key: TABLE, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(count * 3), rule: { noCrossBank: true }, generated: true });
        return items;
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(KIND), tableAt = placed.get(TABLE);
        if (!ids || tableAt === undefined) return [];
        const plain = new Set<string>();
        try { for (const n of JSON.parse(readText(ctx.tree.get(`${DIR}/${META}`)!)).plain ?? []) plain.add(n); } catch { /* reported by encode */ }
        const bytes = new Uint8Array((Math.max(0, ...ids.values()) + 1) * 3);
        for (const [n, id] of ids) {
            const at = placed.get(`${DIR}/${n}`);
            if (at === undefined) continue;
            const v = (at & 0x7FFF) | ((at >> 16) << 15) | (plain.has(n) ? 0 : 0x800000);
            bytes.set([v & 0xFF, (v >> 8) & 0xFF, v >> 16], id * 3);
        }
        const bus = ctx.pointer(tableAt), file = `${DIR}/${ENUM}`;
        const writes: Write[] = [{ at: tableAt, bytes, file }];
        for (const at of SITES) writes.push({ at: at + 1, bytes: Uint8Array.of(bus >> 16), file }, { at: at + 6, bytes: Uint8Array.of(bus & 0xFF, (bus >> 8) & 0xFF), file });
        return writes;
    },
};
