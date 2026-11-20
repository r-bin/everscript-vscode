// The `characters` and `enemies` kinds (docs/open-evermore/resources.md §characters).
//   characters/<name>.json   one character record, its 74 bytes as named fields (docs/entities/character_table.md)
//   enemies/<name>.json      one ENEMY id (what spawn opcodes take): the character it spawns, or a raw address
// Implode writes the records as one block, the enemy index wherever it lands, and the bank byte of every operand
// that reads the records.
//
// Facts used (docs/entities/character_table.md, knowledge routines/character_records.md, tools/table-hack/tables.js,
// where both tables were moved and proven):
//   records   74 bytes apart from $8E:B678, 142 in vanilla (records 0 and 1: the Boy's and the Dog's templates, copied
//             to WRAM $0A26 by `mvn` at $8F:8046). Code reads a field as `op $8E00xx,X` with X = the record's 16-bit
//             address: 131 such operands in the code banks, all in the $8E form (bank $8E mirrors low WRAM, so the
//             same reads reach the Boy and Dog in WRAM). Records are kept by their 16-bit address (the enemy index,
//             entity +$60, and five code immediates: $8F:803D, $8E:A1F0, $8F:99A6/$99EC/$9A27, $91:CD7E), so the
//             block keeps offset $B678 and its order (ids): only its bank moves, in the $80-$BF form. Room for 254
//   enemies   the index at $8E:B55A, one word per id (a record's 16-bit address), read by `lda.l $8EB55A,x` in the
//             four spawn handlers ($8C:DC9A/DCC3/DCD9/DCEC); 143 ids, entries 0/1 the Boy's and Dog's WRAM records;
//             0xBA/0xC2 take a byte id: 256 at most
// Names: our compiler's ENEMY names (language/data/index.json; D4); a record takes its first enemy's name.
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item, Span, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { hexText, parseHex, readerSpans, readerWrites, tableAt } from './readers.mts';
import type { Reader } from './readers.mts';

const require = createRequire(import.meta.url);
const ENEMY_NAMES: { name: string; value: string }[] = require('../../../../src/games/evermore/language/data/index.json').enums.ENEMY ?? [];

export const CHARACTERS = 'characters', ENEMIES = 'enemies';
const RECORDS = `${CHARACTERS}/_records`, INDEX = `${ENEMIES}/_table`;
const OFFSET = 0xB678, STRIDE = 74, VANILLA_RECORDS = 142, VANILLA_ENEMIES = 143, ENEMY_LIMIT = 256;
const RECORD_LIMIT = Math.floor((0x10000 - OFFSET) / STRIDE);
/** `mvn $8E,$8E` at $8F:8046: the source bank (byte 2) is the records' bank. */
const MVN = 0x0F8046;
const ENEMY_READERS: Reader[] = [0x0CDCA2, 0x0CDCCD, 0x0CDCE3, 0x0CDCF4].map(at => ({ at, add: 0 }));
const LONG_OPS = new Set([0xAF, 0x8F, 0x6F, 0xEF, 0xCF, 0x2F, 0x0F, 0x4F, 0xBF, 0x9F, 0x7F, 0xFF, 0xDF, 0x3F, 0x1F, 0x5F]);
const CODE_BANKS = new Set([0x00, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11]);

/** A record's fields: name, offset, bytes, written as a number or as hex (`$xxxx`; the name pointer `$xxxxxx`). */
type Field = [string, number, number, 'n' | 'hex'];
const FIELDS: Field[] = [
    ['name', 0x00, 3, 'hex'], ['behaviour', 0x03, 2, 'hex'], ['flags', 0x05, 2, 'hex'], ['flags2', 0x07, 2, 'hex'],
    ['palette', 0x09, 2, 'hex'], ['palette2', 0x0B, 2, 'hex'], ['radius', 0x0D, 2, 'n'], ['hp', 0x0F, 2, 'n'],
    ['unknown_11', 0x11, 2, 'n'], ['aggro_range', 0x13, 2, 'n'], ['aggro_chance', 0x15, 2, 'n'], ['leash', 0x17, 2, 'n'],
    ['attack', 0x19, 2, 'n'], ['defense', 0x1B, 2, 'n'], ['magic_defense', 0x1D, 2, 'n'], ['evade', 0x1F, 2, 'n'],
    ['hit_rate', 0x21, 2, 'n'], ['exp', 0x23, 4, 'n'], ['money', 0x27, 2, 'n'], ['prize_chance', 0x29, 1, 'n'],
    ['level', 0x2A, 2, 'n'], ['charge_limit', 0x2C, 2, 'n'], ['charge_speed', 0x2E, 2, 'n'], ['attack_proc', 0x30, 2, 'hex'],
];
/** The animation ids at +$32-+$48, by what the game plays them for (character-model.ts). */
const ANIMATIONS = ['stand', 'walk', 'run', 'attack_0', 'attack_1', 'attack_2', 'attack_3', 'knockback', 'death', 'death_with_drop', 'cast', 'dodge'];
const ANIM_AT = 0x32;

const word = (b: Uint8Array, at: number, n: number) => { let v = 0; for (let k = n - 1; k >= 0; k--) v = v * 256 + b[at + k]; return v; };

function recordJson(b: Uint8Array): unknown {
    const out: Record<string, unknown> = {};
    for (const [n, at, size, form] of FIELDS) out[n] = form === 'n' ? word(b, at, size) : hexText(word(b, at, size), size * 2);
    out.animations = Object.fromEntries(ANIMATIONS.map((n, k) => [n, hexText(word(b, ANIM_AT + 2 * k, 2), 4)]));
    return out;
}

/** A record file → its 74 bytes; problems are findings. */
function recordBytes(v: any, path: string, ctx: ImplodeContext): Uint8Array | null {
    const out = new Uint8Array(STRIDE);
    let ok = true;
    const put = (value: unknown, at: number, size: number, form: 'n' | 'hex', pointer: string) => {
        const max = 2 ** (8 * size) - 1;
        const n = form === 'n' ? (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max ? value as number : null) : parseHex(value, max);
        if (n === null) { ctx.findings.error('invalid-value', path, pointer, form === 'n' ? `a whole number 0-${max}` : `"$${'x'.repeat(size * 2)}"`); ok = false; return; }
        for (let k = 0, x = n; k < size; k++, x = Math.floor(x / 256)) out[at + k] = x & 0xFF;
    };
    for (const [n, at, size, form] of FIELDS) put(v?.[n], at, size, form, `/${n}`);
    ANIMATIONS.forEach((n, k) => put(v?.animations?.[n], ANIM_AT + 2 * k, 2, 'hex', `/animations/${n}`));
    return ok ? out : null;
}

/** Our name for ENEMY id `id`: the compiler's, as snake case. */
const ENEMY_DEFAULT = new Map<number, string>();
for (const e of ENEMY_NAMES) {
    const n = e.name.toLowerCase(), id = parseInt(e.value, 16);
    if (NAME_RE.test(n) && !ENEMY_DEFAULT.has(id) && ![...ENEMY_DEFAULT.values()].includes(n)) ENEMY_DEFAULT.set(id, n);
}

/** The records' file offset (their bank from the `mvn`, offset $B678). */
function recordsAt(rom: Uint8Array): number {
    if (rom[MVN] !== 0x54) throw new Error('characters: no `mvn` at $8F:8046; another release?');
    return ((rom[MVN + 2] & 0x3F) << 16) | OFFSET;
}

/** The operand bytes naming the records' bank: the `mvn` source and every long operand into a record. */
function bankSites(rom: Uint8Array): Span[] {
    const bank = rom[MVN + 2], out: Span[] = [{ start: MVN + 2, end: MVN + 3 }];
    for (let o = 0; o + 4 <= rom.length; o++) {
        if (CODE_BANKS.has(o >> 16) && LONG_OPS.has(rom[o]) && rom[o + 2] === 0x00 && rom[o + 1] < STRIDE && rom[o + 3] === bank) out.push({ start: o + 3, end: o + 4 });
    }
    return out;
}

/** Record names: the tree's on a round trip; afresh, the first enemy's that spawns it (boy, dog for the templates). */
function recordNames(rom: Uint8Array, name: (kind: string, id: number) => string, countOf: (kind: string) => number | undefined): string[] {
    const count = countOf(CHARACTERS);
    if (count !== undefined) return Array.from({ length: count }, (_, id) => name(CHARACTERS, id));
    const index = tableAt(rom, ENEMY_READERS, ENEMIES), used = new Set<string>(), out: string[] = [];
    const firstEnemy = new Map<number, number>();
    for (let e = VANILLA_ENEMIES - 1; e >= 0; e--) {
        const k = (word(rom, index + 2 * e, 2) - OFFSET) / STRIDE;
        if (Number.isInteger(k) && k >= 0) firstEnemy.set(k, e);
    }
    for (let id = 0; id < VANILLA_RECORDS; id++) {
        const e = firstEnemy.get(id);
        let n = id === 0 ? 'boy' : id === 1 ? 'dog' : e !== undefined ? name(ENEMIES, e) : `character_${id.toString(16).padStart(2, '0')}`;
        while (used.has(n)) n += '_' + id.toString(16);
        used.add(n); out.push(n);
    }
    return out;
}

export const charactersCodec: Codec = {
    kind: CHARACTERS, version: 1, path: CHARACTERS,

    defaultName: id => `character_${id.toString(16).padStart(2, '0')}`,

    explode(rom, name, _options, countOf) {
        const at = recordsAt(rom), names = recordNames(rom, name, countOf), files: Tree = new Map();
        names.forEach((n, id) => files.set(`${CHARACTERS}/${n}.json`, json(recordJson(rom.subarray(at + STRIDE * id, at + STRIDE * (id + 1))))));
        files.set(`${CHARACTERS}/${ENUM}`, enumFile({
            kind: CHARACTERS, limit: RECORD_LIMIT, names,
            why: 'records are 74 bytes from $xx:B678 to the end of one bank; the id is the record\'s place, so its 16-bit address (code immediates name five records by it): keep the order, add at the end',
        }));
        const length = STRIDE * names.length;
        return { files, pool: [{ start: at, end: at + length }], tables: bankSites(rom), homes: [{ key: RECORDS, at, length, sha1: sha1(rom.subarray(at, at + length)) }] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(CHARACTERS + '/') || path === `${CHARACTERS}/${ENUM}`) continue;
            const m = /^characters\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a character is one <name>.json; ignored');
        }
        return names;
    },

    encode(ctx) {
        const ids = ctx.ids.get(CHARACTERS);
        if (!ids) return [];
        const count = Math.max(-1, ...ids.values()) + 1, bytes = new Uint8Array(STRIDE * count), byId = new Map([...ids].map(([n, id]) => [id, n]));
        for (let id = 0; id < count; id++) {
            const n = byId.get(id);
            if (n === undefined) { ctx.findings.error('id-gap', `${CHARACTERS}/${ENUM}`, `/names/${id}`, `no character has id ${id}: records are addressed by their place`); continue; }
            const path = `${CHARACTERS}/${n}.json`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: unknown;
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            const b = recordBytes(v, path, ctx);
            if (b) bytes.set(b, STRIDE * id);
        }
        // Offset $B678 in a bank the readers reach in the $80-$BF form.
        return [{ key: RECORDS, file: `${CHARACTERS}/${ENUM}`, bytes, rule: { bankOffset: OFFSET, upperHalf: true, below: 0x400000 } }] satisfies Item[];
    },

    tables(ctx, placed) {
        const at = placed.get(RECORDS);
        if (at === undefined) return [];
        const bank = Uint8Array.of(0x80 | (at >> 16));
        return ctx.base.tables.filter(t => t.kind === CHARACTERS).flatMap(t => Array.from({ length: t.end - t.start }, (_, k) => ({ at: t.start + k, bytes: bank, file: `${CHARACTERS}/${ENUM}` })));
    },
};

interface Enemy { character?: string; address?: string }

export const enemiesCodec: Codec = {
    kind: ENEMIES, version: 1, path: ENEMIES,

    defaultName: id => ENEMY_DEFAULT.get(id) ?? `enemy_${id.toString(16).padStart(2, '0')}`,

    explode(rom, name, _options, countOf) {
        const at = tableAt(rom, ENEMY_READERS, ENEMIES), count = countOf(ENEMIES) ?? VANILLA_ENEMIES;
        const records = recordNames(rom, name, countOf), files: Tree = new Map(), names: string[] = [];
        for (let id = 0; id < count; id++) {
            const n = name(ENEMIES, id), v = word(rom, at + 2 * id, 2), k = (v - OFFSET) / STRIDE;
            names.push(n);
            const e: Enemy = Number.isInteger(k) && k >= 0 && k < records.length ? { character: records[k] } : { address: hexText(v, 4) };
            files.set(`${ENEMIES}/${n}.json`, json(e));
        }
        files.set(`${ENEMIES}/${ENUM}`, enumFile({ kind: ENEMIES, limit: ENEMY_LIMIT, names, why: 'spawn opcodes 0xBA/0xC2 take a one-byte ENEMY id; the index is read by `lda.l $8EB55A,x` in the four spawn handlers' }));
        const span = { start: at, end: at + 2 * count };
        return { files, pool: [span], tables: readerSpans(ENEMY_READERS), homes: [{ key: INDEX, at, length: 2 * count, sha1: sha1(rom.subarray(span.start, span.end)) }] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(ENEMIES + '/') || path === `${ENEMIES}/${ENUM}`) continue;
            const m = /^enemies\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'an enemy is one <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const characters = ctx.names.get(CHARACTERS) ?? new Set<string>();
        for (const n of names) {
            const path = `${ENEMIES}/${n}.json`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: Enemy;
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            if (typeof v.character === 'string') { if (!characters.has(v.character)) ctx.findings.error('unknown-reference', path, '/character', `"${v.character}" is no character in ${CHARACTERS}/`); }
            else if (parseHex(v.address, 0xFFFF) === null) ctx.findings.error('invalid-value', path, '', '{ "character": "<name>" } or { "address": "$xxxx" } (a record outside characters/: the Boy\'s and Dog\'s in WRAM)');
        }
        const count = Math.max(-1, ...(ctx.ids.get(ENEMIES)?.values() ?? [])) + 1;
        return [{ key: INDEX, file: `${ENEMIES}/${ENUM}`, bytes: new Uint8Array(2 * count), rule: { noCrossBank: true }, generated: true }] satisfies Item[];
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(ENEMIES), at = placed.get(INDEX), records = ctx.ids.get(CHARACTERS);
        if (!ids || at === undefined || !records) return [];
        const count = Math.max(-1, ...ids.values()) + 1, bytes = new Uint8Array(2 * count), byId = new Map([...ids].map(([n, id]) => [id, n]));
        for (let id = 0; id < count; id++) {
            const n = byId.get(id);
            if (n === undefined) { ctx.findings.error('id-gap', `${ENEMIES}/${ENUM}`, `/names/${id}`, `no enemy has id ${id}; the index cannot skip one yet`); continue; }
            const v: Enemy = JSON.parse(readText(ctx.tree.get(`${ENEMIES}/${n}.json`)!));
            const value = typeof v.character === 'string' ? OFFSET + STRIDE * records.get(v.character)! : parseHex(v.address, 0xFFFF)!;
            bytes.set([value & 0xFF, value >> 8], 2 * id);
        }
        return [{ at, bytes, file: `${ENEMIES}/${ENUM}` }, ...readerWrites(ctx, ENEMY_READERS, at, `${ENEMIES}/${ENUM}`)] satisfies Write[];
    },
};
