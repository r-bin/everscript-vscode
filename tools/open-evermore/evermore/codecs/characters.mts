// The `characters` kind (docs/open-evermore/resources.md §characters): every character record, one folder each.
//   characters/<name>/character.json   the record's fields by name (docs/entities/character_table.md); `spawn` when
//                                      the ENEMY id spawns from another address (the Boy, the Dog: WRAM)
//   characters/<name>/animations.json  the record's twelve animation ids, each with what it shows (animation-view.mts)
//   characters/_enum.json              names[ENEMY id]: what spawn opcodes take (null: no record, address 0)
//   characters/_records.json           the record block's order: a record's place is its 16-bit address
// Implode writes the records as one block, the ENEMY index wherever it lands, and the bank byte of every operand that
// reads the records.
//
// Facts used (docs/entities/character_table.md, knowledge routines/character_records.md, tools/table-hack/tables.js,
// where both tables were moved and proven):
//   records   74 bytes apart from $8E:B678, 142 in vanilla (records 0 and 1: the Boy's and the Dog's templates, copied
//             to WRAM $0A26 by `mvn` at $8F:8046). Code reads a field as `op $8E00xx,X` with X = the record's 16-bit
//             address: 131 such operands in the code banks, all in the $8E form (bank $8E mirrors low WRAM, so the
//             same reads reach the Boy and Dog in WRAM). Records are kept by their 16-bit address (the ENEMY index,
//             entity +$60, and five code immediates, knowledge character_records), so the block keeps offset $B678
//             and its order; only its bank moves, in the $80-$BF form. Room for 254
//   ENEMY     the index at $8E:B55A, one word per id (a record's 16-bit address), read by `lda.l $8EB55A,x` in the
//             four spawn handlers ($8C:DC9A/DCC3/DCD9/DCEC); 143 ids: 0 and 1 the Boy's and Dog's WRAM records, one
//             0, the rest one record each; 0xBA/0xC2 take a byte id: 256 at most
//   fields    behaviour (+$03) and attack proc (+$30) are even ids into the jump tables of handler-tables.mts: written
//             by those kinds' names; the flag words +$05 (OR'd into entity +$10 at spawn) and +$07 as their bits' names,
//             `a | b`, null for none (docs/entities/entities-reference.md §+0x10 bits, character-properties.md §+$07)
// Names: our compiler's ENEMY names (language/data/index.json; D4); `boy`, `dog` for ids 0 and 1.
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item, Span, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { describeRecord } from './animation-view.mts';
import { ATTACK_PROCS, BEHAVIOURS } from './handler-tables.mts';
import { hexText, parseHex, readerSpans, readerWrites, tableAt } from './readers.mts';
import type { Reader } from './readers.mts';

const require = createRequire(import.meta.url);
const ENEMY_NAMES: { name: string; value: string }[] = require('../../../../src/games/evermore/language/data/index.json').enums.ENEMY ?? [];

export const CHARACTERS = 'characters';
const DIR = CHARACTERS, RECORDS_FILE = '_records.json', CHARACTER = 'character.json', ANIMS = 'animations.json';
const RECORDS = `${DIR}/_records`, INDEX = `${DIR}/_enemy_index`;
/** The pseudo kind whose symbols tell a round trip each record's place. */
const RECORD = 'characters.record';
const OFFSET = 0xB678, STRIDE = 74, VANILLA_RECORDS = 142, VANILLA_ENEMIES = 143, ENEMY_LIMIT = 256;
const RECORD_LIMIT = Math.floor((0x10000 - OFFSET) / STRIDE);
/** `mvn $8E,$8E` at $8F:8046: the source bank (byte 2) is the records' bank. */
const MVN = 0x0F8046;
const ENEMY_READERS: Reader[] = [0x0CDCA2, 0x0CDCCD, 0x0CDCE3, 0x0CDCF4].map(at => ({ at, add: 0 }));
const LONG_OPS = new Set([0xAF, 0x8F, 0x6F, 0xEF, 0xCF, 0x2F, 0x0F, 0x4F, 0xBF, 0x9F, 0x7F, 0xFF, 0xDF, 0x3F, 0x1F, 0x5F]);
const CODE_BANKS = new Set([0x00, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11]);

/** The bits of +$05 (entity +$10's names, entities-reference.md) and +$07 (character-properties.md), bit 0 first. */
const SPAWN_FLAGS = ['hidden', 'invincible', 'party', 'parked', 'never_sleeps', 'inactive', 'animating', 'through_bodies',
    'awake', 'asleep', 'phasing', 'following', 'no_gravity', 'hides_after_fall', 'takes_no_damage', 'bit_15'];
const FLAGS2 = ['segmented_body', 'partner_hit_penalty', 'ring_menu_target', 'mask_4000_target', 'projectile_immune',
    ...Array.from({ length: 11 }, (_, k) => `bit_${k + 5}`)];
/** How a field is written: a number, hex (`$xxxx`; the name pointer `$xxxxxx`), an entry of a handler-table kind by
 *  name (the record holds 2·id), or flags by their bits' names. */
type Form = 'n' | 'hex' | { kind: string } | { bits: string[] };
type Field = [string, number, number, Form];
const FIELDS: Field[] = [
    ['name', 0x00, 3, 'hex'], ['behaviour', 0x03, 2, { kind: BEHAVIOURS }], ['flags', 0x05, 2, { bits: SPAWN_FLAGS }], ['flags2', 0x07, 2, { bits: FLAGS2 }],
    ['palette', 0x09, 2, 'hex'], ['palette2', 0x0B, 2, 'hex'], ['radius', 0x0D, 2, 'n'], ['hp', 0x0F, 2, 'n'],
    ['unknown_11', 0x11, 2, 'n'], ['aggro_range', 0x13, 2, 'n'], ['aggro_chance', 0x15, 2, 'n'], ['leash', 0x17, 2, 'n'],
    ['attack', 0x19, 2, 'n'], ['defense', 0x1B, 2, 'n'], ['magic_defense', 0x1D, 2, 'n'], ['evade', 0x1F, 2, 'n'],
    ['hit_rate', 0x21, 2, 'n'], ['exp', 0x23, 4, 'n'], ['money', 0x27, 2, 'n'], ['prize_chance', 0x29, 1, 'n'],
    ['level', 0x2A, 2, 'n'], ['charge_limit', 0x2C, 2, 'n'], ['charge_speed', 0x2E, 2, 'n'], ['attack_proc', 0x30, 2, { kind: ATTACK_PROCS }],
];
/** The animation ids at +$32-+$48, by what the game plays them for (character-model.ts): animation record offsets. */
/** Entries of the handler tables (handler-tables.mts): an id past them is written as hex. */
const TABLE_SIZE: Record<string, number> = { [ATTACK_PROCS]: 15, [BEHAVIOURS]: 15 };
const ANIMATIONS = ['stand', 'walk', 'run', 'attack_0', 'attack_1', 'attack_2', 'attack_3', 'knockback', 'death', 'death_with_drop', 'cast', 'dodge'];
const ANIM_AT = 0x32;

const word = (b: Uint8Array, at: number, n: number) => { let v = 0; for (let k = n - 1; k >= 0; k--) v = v * 256 + b[at + k]; return v; };

/** A record file pair → its 74 bytes; problems are findings. */
function recordBytes(c: any, a: any, dir: string, ctx: ImplodeContext): Uint8Array | null {
    const out = new Uint8Array(STRIDE);
    let ok = true;
    const put = (value: unknown, at: number, size: number, form: Form, path: string, pointer: string) => {
        const max = 2 ** (8 * size) - 1;
        const n = fieldValue(value, form, max, ctx);
        if (n === null) { ctx.findings.error(typeof form === 'object' && 'kind' in form && typeof value === 'string' && !value.startsWith('$') ? 'unknown-reference' : 'invalid-value', path, pointer, expected(form, size, max)); ok = false; return; }
        for (let k = 0, x = n; k < size; k++, x = Math.floor(x / 256)) out[at + k] = x & 0xFF;
    };
    for (const [n, at, size, form] of FIELDS) put(c?.[n], at, size, form, `${dir}/${CHARACTER}`, `/${n}`);
    ANIMATIONS.forEach((n, k) => put(a?.[n]?.record, ANIM_AT + 2 * k, 2, 'hex', `${dir}/${ANIMS}`, `/${n}/record`));
    return ok ? out : null;
}

/** A field as written → its value, or null. */
function fieldValue(v: unknown, form: Form, max: number, ctx: ImplodeContext): number | null {
    if (form === 'n') return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? v as number : null;
    if (form === 'hex') return parseHex(v, max);
    if ('kind' in form) { const id = typeof v === 'string' ? ctx.ids.get(form.kind)?.get(v) : undefined; return id !== undefined ? 2 * id : parseHex(v, max); }
    if (v === null) return 0;
    if (typeof v !== 'string') return null;
    let n = 0;
    for (const t of v.split('|').map(x => x.trim())) { const b = form.bits.indexOf(t); if (b < 0) return null; n |= 1 << b; }
    return n;
}
const expected = (form: Form, size: number, max: number) => form === 'n' ? `a whole number 0-${max}` : form === 'hex' ? `"$${'x'.repeat(size * 2)}"`
    : 'kind' in form ? `a name in ${form.kind}/` : `null, or bits joined by " | " (${form.bits.filter(b => !b.startsWith('bit_')).join(', ')}, bit_<n>)`;
/** A field's value as written. */
function fieldText(v: number, form: Form, size: number, name: (kind: string, id: number) => string, count: (kind: string) => number): unknown {
    if (form === 'n') return v;
    if (form === 'hex') return hexText(v, size * 2);
    if ('kind' in form) return v % 2 === 0 && v / 2 < count(form.kind) ? name(form.kind, v / 2) : hexText(v, size * 2);
    return v ? form.bits.filter((_, b) => v & (1 << b)).join(' | ') : null;
}

/** Our name for ENEMY id `id`: the compiler's, as snake case; the Boy and the Dog by theirs. */
const ENEMY_DEFAULT = new Map<number, string>([[0, 'boy'], [1, 'dog']]);
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

/** Each ENEMY id: the record it spawns (its index in the block), or a raw address (the Boy's, Dog's WRAM; 0). */
function enemyEntries(rom: Uint8Array, count: number, records: number) {
    const index = tableAt(rom, ENEMY_READERS, CHARACTERS);
    return Array.from({ length: count }, (_, e) => {
        const v = word(rom, index + 2 * e, 2), k = (v - OFFSET) / STRIDE;
        return Number.isInteger(k) && k >= 0 && k < records ? { record: k } : { address: v };
    });
}

/** Names afresh: a record takes the name of the ENEMY id that spawns it; the Boy's and Dog's templates the ids that
 *  spawn from WRAM (0, 1); a record no id spawns `character_<n>`. Null for an id with no record (address 0). */
function freshNames(rom: Uint8Array): { records: string[]; enemies: (string | null)[]; spawn: Map<string, number> } {
    const entries = enemyEntries(rom, VANILLA_ENEMIES, VANILLA_RECORDS), records: (string | undefined)[] = new Array(VANILLA_RECORDS).fill(undefined);
    const enemies: (string | null)[] = [], spawn = new Map<string, number>(), used = new Set<string>();
    const claim = (n: string) => { let out = n, k = 2; while (used.has(out)) out = `${n}_${k++}`; used.add(out); return out; };
    entries.forEach((e, id) => {
        if ('record' in e) { const n = claim(ENEMY_DEFAULT.get(id) ?? `enemy_${id.toString(16).padStart(2, '0')}`); records[e.record!] = n; enemies.push(n); }
        else if (id < 2) { const n = claim(ENEMY_DEFAULT.get(id)!); records[id] = n; spawn.set(n, e.address!); enemies.push(n); }
        else enemies.push(null);
    });
    return { records: records.map((n, k) => n ?? claim(`character_${k.toString(16).padStart(2, '0')}`)), enemies, spawn };
}

export const charactersCodec: Codec = {
    kind: CHARACTERS, version: 2, path: DIR, listedIdsOnly: true,

    defaultName: id => ENEMY_DEFAULT.get(id) ?? `enemy_${id.toString(16).padStart(2, '0')}`,

    // animations.json is the twelve record ids; what each shows is derived for the reader.
    canonical(path, bytes) {
        if (!path.endsWith('/' + ANIMS)) return [path, bytes];
        const v = JSON.parse(readText(bytes));
        return [path, json(Object.fromEntries(ANIMATIONS.map(n => [n, v[n]?.record])))];
    },

    explode(rom, name, _options, countOf, nameAt) {
        const at = recordsAt(rom);
        // On a round trip the tree's names: the records' order from where implode put each one (symbols), ENEMY ids
        // from the enum.
        const round = countOf(CHARACTERS) !== undefined;
        let records: string[], enemies: (string | null)[], spawn = new Map<string, number>();
        if (!round) ({ records, enemies, spawn } = freshNames(rom));
        else {
            const count = countOf(CHARACTERS)!;
            records = [];
            for (let k = 0; nameAt(RECORD, at + STRIDE * k) !== undefined; k++) records.push(nameAt(RECORD, at + STRIDE * k)!);
            const entries = enemyEntries(rom, count, records.length);
            enemies = entries.map((e, id) => 'record' in e ? records[e.record!] : e.address ? name(CHARACTERS, id) : null);
            entries.forEach((e, id) => { if (!('record' in e) && e.address) spawn.set(name(CHARACTERS, id), e.address); });
        }
        const files: Tree = new Map();
        records.forEach((n, k) => {
            const b = rom.subarray(at + STRIDE * k, at + STRIDE * (k + 1)), c: Record<string, unknown> = {};
            for (const [f, off, size, form] of FIELDS) c[f] = fieldText(word(b, off, size), form, size, name, k => countOf(k) ?? TABLE_SIZE[k]);
            if (spawn.has(n)) c.spawn = hexText(spawn.get(n)!, 4);
            files.set(`${DIR}/${n}/${CHARACTER}`, json(c));
            files.set(`${DIR}/${n}/${ANIMS}`, json(Object.fromEntries(ANIMATIONS.map((f, i) => {
                const r = word(b, ANIM_AT + 2 * i, 2);
                return [f, { record: hexText(r, 4), ...(describeRecord(rom, r, name) ?? {}) }];
            }))));
        });
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: CHARACTERS, limit: ENEMY_LIMIT, names: enemies as string[], why: 'ENEMY ids, what spawn opcodes take (0xBA/0xC2: one byte); null: an id with no record' }));
        files.set(`${DIR}/${RECORDS_FILE}`, json({ why: `the record block in order: record k is at $xx:${OFFSET.toString(16).toUpperCase()} + 74·k, the address code and save data keep; add at the end (${RECORD_LIMIT} at most)`, names: records }));
        const length = STRIDE * records.length, index = tableAt(rom, ENEMY_READERS, CHARACTERS), ids = enemies.length;
        return {
            files,
            pool: [{ start: at, end: at + length }, { start: index, end: index + 2 * ids }],
            tables: [...bankSites(rom), ...readerSpans(ENEMY_READERS)],
            homes: [
                { key: RECORDS, at, length, sha1: sha1(rom.subarray(at, at + length)) },
                { key: INDEX, at: index, length: 2 * ids, sha1: sha1(rom.subarray(index, index + 2 * ids)) },
            ],
        };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}` || path === `${DIR}/${RECORDS_FILE}`) continue;
            const m = /^characters\/([^/]+)\/([^/]+)$/.exec(path);
            if (m && (m[2] === CHARACTER || m[2] === ANIMS)) names.add(m[1]);
            else findings.warning('unknown-file', path, '', `a character is a folder with ${CHARACTER} and ${ANIMS}; ignored`);
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx, recordsPath = `${DIR}/${RECORDS_FILE}`;
        let order: string[] = [];
        try { order = JSON.parse(readText(tree.get(recordsPath) ?? new Uint8Array())).names ?? []; } catch (e) { findings.error('parse-error', recordsPath, '', (e as Error).message); return []; }
        if (!Array.isArray(order) || order.length > RECORD_LIMIT) { findings.error('schema', recordsPath, '/names', `a list of at most ${RECORD_LIMIT} characters`); return []; }
        const place = new Map<string, number>();
        order.forEach((n, k) => {
            if (!names.has(n)) findings.error('unknown-reference', recordsPath, `/names/${k}`, `"${n}" is no character folder`);
            else if (place.has(n)) findings.error('duplicate-name', recordsPath, `/names/${k}`, `"${n}" is also record ${place.get(n)}`);
            else place.set(n, k);
        });
        const bytes = new Uint8Array(STRIDE * order.length), spawn = new Map<string, number>();
        for (const n of names) {
            const dir = `${DIR}/${n}`;
            if (!NAME_RE.test(n)) { findings.error('bad-name', `${dir}/${CHARACTER}`, '', `"${n}": snake_case, at most 80 characters`); continue; }
            if (!place.has(n)) { findings.error('not-placed', `${dir}/${CHARACTER}`, '', `list "${n}" in ${recordsPath}: a record's place is its address`); continue; }
            let c: any, a: any;
            try { c = JSON.parse(readText(tree.get(`${dir}/${CHARACTER}`) ?? new Uint8Array())); } catch (e) { findings.error('parse-error', `${dir}/${CHARACTER}`, '', (e as Error).message); continue; }
            try { a = JSON.parse(readText(tree.get(`${dir}/${ANIMS}`) ?? new Uint8Array())); } catch (e) { findings.error('parse-error', `${dir}/${ANIMS}`, '', (e as Error).message); continue; }
            if (c.spawn !== undefined) { const v = parseHex(c.spawn, 0xFFFF); if (v === null) findings.error('invalid-value', `${dir}/${CHARACTER}`, '/spawn', '"$xxxx": the address its ENEMY id spawns from'); else spawn.set(n, v); }
            const b = recordBytes(c, a, dir, ctx);
            if (b) bytes.set(b, STRIDE * place.get(n)!);
        }
        state.set(ctx, { place, spawn });
        const count = Math.max(-1, ...(ctx.ids.get(CHARACTERS)?.values() ?? [])) + 1;
        // Offset $B678 in a bank the readers reach in the $80-$BF form; the index, long-indexed, inside one bank.
        return [
            { key: RECORDS, file: recordsPath, bytes, rule: { bankOffset: OFFSET, upperHalf: true, below: 0x400000 } },
            { key: INDEX, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(2 * count), rule: { noCrossBank: true }, generated: true },
        ] satisfies Item[];
    },

    symbols(ctx, placed) {
        const at = placed.get(RECORDS), s = state.get(ctx);
        return new Map(at === undefined || !s ? [] : [...s.place].map(([n, k]) => [`${RECORD}/${n}`, at + STRIDE * k] as [string, number]));
    },

    tables(ctx, placed) {
        const at = placed.get(RECORDS), index = placed.get(INDEX), ids = ctx.ids.get(CHARACTERS), s = state.get(ctx);
        if (at === undefined || index === undefined || !ids || !s) return [];
        const bank = Uint8Array.of(0x80 | (at >> 16));
        const writes: Write[] = ctx.base.tables.filter(t => t.kind === CHARACTERS && t.end - t.start === 1).map(t => ({ at: t.start, bytes: bank, file: `${DIR}/${RECORDS_FILE}` }));
        const count = Math.max(-1, ...ids.values()) + 1, table = new Uint8Array(2 * count), byId = new Map([...ids].map(([n, id]) => [id, n]));
        for (let id = 0; id < count; id++) {
            const n = byId.get(id);
            const v = n === undefined ? 0 : s.spawn.get(n) ?? OFFSET + STRIDE * s.place.get(n)!;
            table.set([v & 0xFF, v >> 8], 2 * id);
        }
        return [...writes, { at: index, bytes: table, file: `${DIR}/${ENUM}` }, ...readerWrites(ctx, ENEMY_READERS, index, `${DIR}/${ENUM}`)];
    },
};

const state = new WeakMap<ImplodeContext, { place: Map<string, number>; spawn: Map<string, number> }>();
