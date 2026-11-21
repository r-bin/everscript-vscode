// The `projectiles` kind (docs/open-evermore/resources.md §projectiles): what script opcode 0xB5 launches, one file
// per entry of the projectile table, characters/projectiles/<name>.json: its 24-byte record by field, the routines it
// runs by name, its contact handler by its attack_procs name. projectiles/_enum.json names[id]; a script names
// projectile id k with the kind 2·k, and writes a lone constant kind by the projectile's name (script-lines.mts).
//
// Facts used (docs/entities/animation_script.md §Projectiles, knowledge SCRIPT_PROJECTILE_TABLE, tbl_projectile_records,
// PROJECTILE_MOVEMENT_ROUTINES; decoder maps/projectiles.ts):
//   table     $90:D986, 16 words, read only by `lda.l $90D986,x` at $8C:E851 with X = the kind: a record's 16-bit
//             address in bank $90. The records follow at $90:D9A6, so the table cannot grow: 16 ids, written in place
//   records   24 bytes in bank $90, read as $900000 + address. Animation command 0x4C names records by address too,
//             from animation scripts that stay in _base/: each record stays at its home (implode writes it there),
//             and a new projectile has no room (bank $90 is full). The five records the table does not list stay in
//             _base/
//   routines  +$08 (thrown by an animation), +$0A (launched by a script) and +$0C (each tick, via entity +$26) pick a
//             routine of the table at $90:D967 by 2·k, k ≤ 14 (from k = 15 on the words are the projectile table):
//             written by the routine's name, looked up in that table (it stays in _base/)
//   power     +$16; 0: the thrower's attack scaled by its stamina ($8F:C02B)
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { ATTACK_PROCS } from './handler-tables.mts';
import { hexText, parseHex, routines } from './readers.mts';

const require = createRequire(import.meta.url);
const { projectileRecord, PROJECTILE_STRIDE } = require('../../../../dist/games/evermore/maps/projectiles');

export const KIND = 'projectiles';
export const PROJECTILE_COUNT = 16;
const DIR = KIND, TABLE = 0x10D986, COUNT = PROJECTILE_COUNT, BANK = 0x90, FILE_BANK = 0x10, ROUTINES = 0x10D967, ROUTINE_COUNT = 15;
/** Entries of the attack proc table (handler-tables.mts). */
const ATTACK_PROC_COUNT = 15;
const HANDLERS = routines(BANK);

type Form = 'hex' | 'n' | 's' | 'routine' | 'attack_proc';
/** The record's words: [field, the decoder's name, form]. */
const FIELDS: [string, string, Form][] = [
    ['animation', 'animRecord', 'hex'], ['palette', 'palette', 'hex'], ['unknown_04', 'field04', 'hex'], ['unknown_06', 'field06', 'hex'],
    ['routine', 'routine', 'routine'], ['script_routine', 'scriptRoutine', 'routine'], ['behaviour', 'field0c', 'routine'],
    ['speed', 'speed', 'n'], ['lifetime', 'field10', 'n'], ['z_speed', 'field12', 's'], ['attack_proc', 'field14', 'attack_proc'], ['power', 'power', 'n'],
];
const WHAT: Record<string, string> = {
    animation: '+$00: animation record (bank $C4), started with the thrower\'s facing; $0000: none',
    palette: '+$02: palette ($90:CD80); $0000 keeps the thrower\'s',
    routine: '+$08: setup when an animation throws it (0x4C)', script_routine: '+$0A: setup when a script launches it (0xB5)',
    behaviour: '+$0C: what it does each tick (entity +$26)', speed: '+$0E: 1/16 px per tick (routines $02, $04)',
    lifetime: '+$10: ticks (entity +$1E)', z_speed: '+$12: entity +$24 (routines $02, $04, $16, $18)',
    attack_proc: '+$14: contact handler (entity +$2A)', power: '+$16: damage power; 0 = the thrower\'s attack by its stamina',
};

/** The routine table's words (k ≤ 14), from an image whose $90:D967 is vanilla's. */
const routineWords = (image: Uint8Array): number[] => Array.from({ length: ROUTINE_COUNT }, (_, k) => image[ROUTINES + 2 * k] | (image[ROUTINES + 2 * k + 1] << 8));

/** A field's value as written. */
function fieldText(v: number, form: Form, words: number[], name: (kind: string, id: number) => string): unknown {
    if (form === 'n') return v;
    if (form === 's') return (v << 16) >> 16;
    if (form === 'routine') return v % 2 === 0 && v / 2 < ROUTINE_COUNT ? HANDLERS.name(words[v / 2]) : hexText(v, 4);
    if (form === 'attack_proc') return v % 2 === 0 && v / 2 < ATTACK_PROC_COUNT ? name(ATTACK_PROCS, v / 2) : hexText(v, 4);
    return hexText(v, 4);
}
/** A field as written → its word, or null. */
function fieldValue(v: unknown, form: Form, words: number[], ctx: ImplodeContext): number | null {
    if (form === 'n') return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 0xFFFF ? v as number : null;
    if (form === 's') return Number.isInteger(v) && (v as number) >= -0x8000 && (v as number) <= 0x7FFF ? (v as number) & 0xFFFF : null;
    if (form === 'routine' && typeof v === 'string' && !v.startsWith('$')) { const at = HANDLERS.at(v), k = at === null ? -1 : words.indexOf(at); return k < 0 ? null : 2 * k; }
    if (form === 'attack_proc' && typeof v === 'string' && !v.startsWith('$')) { const id = ctx.ids.get(ATTACK_PROCS)?.get(v); return id === undefined ? null : 2 * id; }
    return parseHex(v, 0xFFFF);
}
const expected = (form: Form) => form === 'n' ? 'a whole number 0-65535' : form === 's' ? 'a whole number -32768-32767'
    : form === 'routine' ? 'a routine of the table at $90:D967 by name (soe://rom/code/), or "$xxxx" (the selector)'
    : form === 'attack_proc' ? `a name in ${ATTACK_PROCS}/, or "$xxxx"` : '"$xxxx"';

/** Each id's record address (16 bits, bank $90). */
const tableOf = (rom: Uint8Array): number[] => Array.from({ length: COUNT }, (_, i) => rom[TABLE + 2 * i] | (rom[TABLE + 2 * i + 1] << 8));
const fileOf = (address: number) => (FILE_BANK << 16) | address;

export const projectilesCodec: Codec = {
    kind: KIND, version: 1, path: DIR, folder: `characters/${DIR}`,

    defaultName: id => `projectile_${String(id).padStart(2, '0')}`,

    // The fields are the record; `what` is for the reader.
    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes));
        delete v.what;
        return [path, json(v)];
    },

    explode(rom, name) {
        const files: Tree = new Map(), names: string[] = [], pool = [], homes = [];
        const words = routineWords(rom), addresses = tableOf(rom);
        if (new Set(addresses).size !== COUNT) throw new Error(`${DIR}: two ids share a record; explode would lose which`);
        for (let id = 0; id < COUNT; id++) {
            const n = name(KIND, id), at = fileOf(addresses[id]), r = projectileRecord(rom, addresses[id]);
            names.push(n);
            const v: Record<string, unknown> = {};
            for (const [field, key, form] of FIELDS) v[field] = fieldText(r[key], form, words, name);
            files.set(`${DIR}/${n}.json`, json({ ...v, what: WHAT }));
            pool.push({ start: at, end: at + PROJECTILE_STRIDE });
            homes.push({ key: `${DIR}/${n}`, at, length: PROJECTILE_STRIDE, sha1: sha1(rom.subarray(at, at + PROJECTILE_STRIDE)) });
        }
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: COUNT, names, why: 'the table at $90:D986 (lda.l $90D986,x at $8C:E851, X = 2·id) holds 16 words; the records follow it' }));
        return { files, pool, tables: [{ start: TABLE, end: TABLE + 2 * COUNT }], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^projectiles\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a projectile is one <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const items: Item[] = [], words = routineWords(ctx.base.image);
        // A renamed projectile keeps its id's home: vanilla lists the records in address order, so id k's is the k-th.
        const homes = [...ctx.base.homes].filter(([key]) => key.startsWith(`${DIR}/`)).sort((a, b) => a[1].at - b[1].at);
        const homeOf = (n: string) => {
            const own = ctx.base.homes.get(`${DIR}/${n}`), id = ctx.ids.get(KIND)?.get(n);
            if (own || id === undefined || !homes[id]) return own;
            return names.has(homes[id][0].slice(DIR.length + 1)) ? undefined : homes[id][1];
        };
        for (const n of names) {
            const path = `${DIR}/${n}.json`, key = `${DIR}/${n}`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: Record<string, unknown>;
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            const bytes = new Uint8Array(PROJECTILE_STRIDE);
            let ok = true;
            FIELDS.forEach(([field, , form], k) => {
                const w = fieldValue(v[field], form, words, ctx);
                if (w === null) { ctx.findings.error(form === 'attack_proc' || form === 'routine' ? 'unknown-reference' : 'invalid-value', path, `/${field}`, expected(form)); ok = false; return; }
                bytes.set([w & 0xFF, w >> 8], 2 * k);
            });
            const home = homeOf(n);
            if (!home) { ctx.findings.error('no-room', path, '', `"${n}" has no record: animation scripts name records by address, so they stay where they are, and bank $90 has no free byte for a new one; change an existing projectile instead`); continue; }
            // Pinned: only its home fits.
            if (ok) items.push({ key, file: path, bytes, rule: { above: home.at, below: home.at + PROJECTILE_STRIDE, bankOffset: home.at & 0xFFFF } });
        }
        return items;
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(KIND);
        if (!ids) return [];
        const table = new Uint8Array(2 * COUNT), byId = new Map([...ids].map(([n, id]) => [id, n]));
        for (let id = 0; id < COUNT; id++) {
            const n = byId.get(id), at = n === undefined ? undefined : placed.get(`${DIR}/${n}`);
            if (n === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no projectile has id ${id}; the table has no gaps`); continue; }
            if (at === undefined) continue;
            if (at >> 16 !== FILE_BANK) { ctx.findings.error('out-of-range', `${DIR}/${n}.json`, '', 'a record must lie in bank $90 (the table holds 16-bit addresses)'); continue; }
            table.set([at & 0xFF, (at >> 8) & 0xFF], 2 * id);
        }
        return [{ at: TABLE, bytes: table, file: `${DIR}/${ENUM}` }] satisfies Write[];
    },
};
