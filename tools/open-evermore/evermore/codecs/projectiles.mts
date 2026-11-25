// The `projectiles` kind (docs/open-evermore/resources.md §projectiles): all 21 projectile records in bank $90
// ($90:D9A6-$DB86), 16 launched by script opcode 0xB5 (via $90:D986) and 5 thrown only by animation command 0x4C,
// one file per record in characters/projectiles/<name>.json. projectiles/_enum.json names the 16 script-table ids.
//
// Facts used (docs/entities/animation_script.md §Projectiles, knowledge SCRIPT_PROJECTILE_TABLE, tbl_projectile_records,
// PROJECTILE_MOVEMENT_ROUTINES; decoder maps/projectiles.ts):
//   table     $90:D986, 16 words, read only by `lda.l $90D986,x` at $8C:E851 with X = 2·id: a record's 16-bit
//             address in bank $90. The records follow at $90:D9A6, so the table cannot grow: 16 ids, written in place
//   records   21 × 24 bytes in bank $90 ($90:D9A6-$DB9D), read as $900000 + address. Animation command 0x4C names them
//             by name and patches the placed 16-bit offset; each stays at its home in bank $90 (bank $90 has no free byte)
//   routines  +$08 (thrown by an animation), +$0A (launched by a script) and +$0C (each tick, via entity +$26) pick a
//             routine of the table at $90:D967 by 2·k, k ≤ 14 (from k = 15 on the words are the projectile table):
//             written by the routine's name, looked up in that table (it stays in _base/)
//   power     +$16; 0: the thrower's attack scaled by its stamina ($8F:C02B)
import * as map from '../map.mts';
import { createRequire } from 'node:module';
import type { Codec, CountOf, ImplodeContext, Item, NameAt, NameOf, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { ANIMATIONS, animationInitialOffset, animationPlacedOffset, animationRef } from './animations.mts';
import { ATTACK_PROCS } from './handler-tables.mts';
import { hexText, parseHex, routines } from './readers.mts';
import { ANIM_PROJECTILE_NAMES, animProjectileName, PROJECTILE_NAMES, projectileDefaultName } from './projectile-names.mts';
import { SPRITE_PALETTES, spritePaletteAddr, spritePaletteName } from './sprite-palettes.mts';

const require = createRequire(import.meta.url);
const { projectileRecord, PROJECTILE_STRIDE } = require('../../../../dist/games/evermore/maps/projectiles');

export const KIND = 'projectiles';
export const PROJECTILE_COUNT = 16;
const ALL_PROJECTILE_COUNT = 21;
const FIRST_RECORD = map.offset('projectiles.records');
const DIR = KIND, TABLE = map.file('projectiles.table'), COUNT = PROJECTILE_COUNT, BANK = map.bank('projectiles.table'), FILE_BANK = TABLE >> 16, ROUTINES = map.file('projectiles.movement_routines'), ROUTINE_COUNT = 15;
/** Entries of the attack proc table (handler-tables.mts). */
const ATTACK_PROC_COUNT = 15;
const HANDLERS = routines(BANK);

type Form = 'hex' | 'n' | 's' | 'routine' | 'attack_proc' | 'animation' | 'sprite_palette';
/** The record's words: [field, the decoder's name, form]. */
const FIELDS: [string, string, Form][] = [
    ['animation', 'animRecord', 'animation'], ['palette', 'palette', 'sprite_palette'], ['unknown_04', 'field04', 'hex'], ['unknown_06', 'field06', 'hex'],
    ['routine', 'routine', 'routine'], ['script_routine', 'scriptRoutine', 'routine'], ['behaviour', 'field0c', 'routine'],
    ['speed', 'speed', 'n'], ['lifetime', 'field10', 'n'], ['z_speed', 'field12', 's'], ['attack_proc', 'field14', 'attack_proc'], ['power', 'power', 'n'],
];
const WHAT: Record<string, string> = {
    animation: '+$00: animation in animations/, started with the thrower\'s facing; null: none',
    palette: '+$02: sprite palette in palettes/sprites/; null keeps the thrower\'s',
    routine: '+$08: setup when an animation throws it (0x4C)', script_routine: '+$0A: setup when a script launches it (0xB5)',
    behaviour: '+$0C: what it does each tick (entity +$26)', speed: '+$0E: 1/16 px per tick (routines $02, $04)',
    lifetime: '+$10: ticks (entity +$1E)', z_speed: '+$12: entity +$24 (routines $02, $04, $16, $18)',
    attack_proc: '+$14: contact handler (entity +$2A)', power: '+$16: damage power; 0 = the thrower\'s attack by its stamina',
};

const README = 'README.md';
/** The kind's README: what each field of a record does (one place, not in every file). */
const readme = () => [
    '# Projectiles', '',
    'One file per projectile record (24 bytes in bank `$90`). The 16 in `_enum.json` are the ids script opcode `0xB5`',
    '(`projectile`) launches; the others only animation scripts throw (`projectile <name>, dx, dy, dz`, opcode `0x4C`).',
    'Names say what throws each (tools/open-evermore/evermore/codecs/projectile-names.mts). Records stay where they are',
    '(bank `$90` has no free byte): change one, do not add one.', '',
    '| Field | Does |', '|---|---|',
    ...Object.entries(WHAT).map(([k, w]) => `| \`${k}\` | ${w} |`),
    '| `unknown_04`, `unknown_06` | +$04, +$06: no reader seen |', '',
    'An animation throws with `routine`; a script launches with `script_routine`; both then tick `behaviour`. A script can',
    'launch any id, but it runs that record\'s `script_routine` (vanilla: the straight flight for ids 0-12), so the',
    'boomerang (`vigor_boomerang`) launched by a script flies straight: give it `script_routine:',
    'projectile_trajectory_polar_to_cartesian` (its `routine`) for the orbit (not tried in game).', '',
].join('\n');

/** The routine table's words (k ≤ 14), from an image whose $90:D967 is vanilla's. */
const routineWords = (image: Uint8Array): number[] => Array.from({ length: ROUTINE_COUNT }, (_, k) => image[ROUTINES + 2 * k] | (image[ROUTINES + 2 * k + 1] << 8));

/** A field's value as written. */
function fieldText(
    rom: Uint8Array,
    v: number,
    form: Form,
    words: number[],
    name: NameOf,
    countOf: CountOf,
    nameAt: NameAt,
): unknown {
    if (form === 'n') return v;
    if (form === 's') return (v << 16) >> 16;
    if (form === 'routine') return v % 2 === 0 && v / 2 < ROUTINE_COUNT ? HANDLERS.name(words[v / 2]) : hexText(v, 4);
    if (form === 'attack_proc') return v % 2 === 0 && v / 2 < ATTACK_PROC_COUNT ? name(ATTACK_PROCS, v / 2) : hexText(v, 4);
    if (form === 'animation') {
        if (!v) return null;
        const ref = animationRef(rom, v, name, countOf, nameAt);
        if (ref?.facing) throw new Error(`${KIND}: animation points to interior facing $${v.toString(16)}`);
        return ref ? ref.animation : hexText(v, 4, 0xC4);
    }
    if (form === 'sprite_palette') {
        if (!v) return null;
        try { return spritePaletteName(rom, v, name, countOf, nameAt); } catch { return hexText(v, 4); }
    }
    return hexText(v, 4);
}
/** A field as written → its word, or null. */
function fieldValue(v: unknown, form: Form, words: number[], ctx: ImplodeContext): number | null {
    if (form === 'n') return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 0xFFFF ? v as number : null;
    if (form === 's') return Number.isInteger(v) && (v as number) >= -0x8000 && (v as number) <= 0x7FFF ? (v as number) & 0xFFFF : null;
    if (form === 'routine' && typeof v === 'string' && !v.startsWith('$')) { const at = HANDLERS.at(v), k = at === null ? -1 : words.indexOf(at); return k < 0 ? null : 2 * k; }
    if (form === 'attack_proc' && typeof v === 'string' && !v.startsWith('$')) { const id = ctx.ids.get(ATTACK_PROCS)?.get(v); return id === undefined ? null : 2 * id; }
    if (form === 'animation') {
        if (v === null) return 0;
        const anims = ctx.names.get(ANIMATIONS);
        if (anims && typeof v === 'string' && !v.startsWith('$')) return anims.has(v) ? (animationInitialOffset(ctx, v) ?? 0) : null;
        return parseHex(v, 0xFFFF, 0xC4);
    }
    if (form === 'sprite_palette') {
        if (v === null) return 0;
        const pals = ctx.ids.get(SPRITE_PALETTES);
        if (pals && typeof v === 'string' && !v.startsWith('$')) { const id = pals.get(v); return id !== undefined ? spritePaletteAddr(id) : null; }
        return parseHex(v, 0xFFFF);
    }
    return parseHex(v, 0xFFFF);
}
const expected = (form: Form) => form === 'n' ? 'a whole number 0-65535' : form === 's' ? 'a whole number -32768-32767'
    : form === 'routine' ? 'a routine of the table at $90:D967 by name (soe://rom/code/), or "$xxxx" (the selector)'
    : form === 'attack_proc' ? `a name in ${ATTACK_PROCS}/, or "$xxxx"`
    : form === 'animation' ? `an animation name in ${ANIMATIONS}/, or null`
    : form === 'sprite_palette' ? `a sprite palette name in ${SPRITE_PALETTES}/ (palettes/sprites/), or null`
    : '"$xxxx"';

/** Each id's record address (16 bits, bank $90). */
const tableOf = (rom: Uint8Array): number[] => Array.from({ length: COUNT }, (_, i) => rom[TABLE + 2 * i] | (rom[TABLE + 2 * i + 1] << 8));
const allRecordAddrs = (): number[] => Array.from({ length: ALL_PROJECTILE_COUNT }, (_, k) => FIRST_RECORD + PROJECTILE_STRIDE * k);
const fileOf = (address: number) => (FILE_BANK << 16) | address;
const projAnimRefs = new WeakMap<ImplodeContext, Map<string, string>>();

/** Resolve a 16-bit bank-$90 projectile record offset to its resource name (all 21 records). */
export function projectileNameAt(rom: Uint8Array, addr16: number, name: NameOf, countOf: CountOf, nameAt: NameAt): string | null {
    const rt = nameAt(KIND, fileOf(addr16));
    if (rt !== undefined) return rt;
    const addrs = tableOf(rom);
    const id = addrs.indexOf(addr16);
    if (id >= 0) return countOf(KIND) !== undefined ? name(KIND, id) : projectileDefaultName(id);
    const animOnly = allRecordAddrs().filter(a => !addrs.includes(a));
    const idx = animOnly.indexOf(addr16);
    if (idx >= 0) return animProjectileName(idx);
    return null;
}

/** Resolve a projectile resource name to its 16-bit bank-$90 home offset (or vanilla offset when projectiles are not exploded). */
export function projectileInitialOffset(ctx: ImplodeContext, projName: string): number | null {
    const own = ctx.base.homes.get(`${DIR}/${projName}`);
    if (own) return own.at & 0xFFFF;
    const id = ctx.ids.get(KIND)?.get(projName);
    if (id !== undefined && id < COUNT) return tableOf(ctx.base.image)[id];
    const addrs = tableOf(ctx.base.image);
    // Not exploded: the default names (projectile-names.mts), or the numbered names of trees before v0.470.0.
    const k = PROJECTILE_NAMES.indexOf(projName), m = /^projectile_(\d+)$/.exec(projName);
    if (k >= 0) return addrs[k];
    if (m && Number(m[1]) < COUNT) return addrs[Number(m[1])];
    const animOnly = allRecordAddrs().filter(a => !addrs.includes(a));
    const ka = ANIM_PROJECTILE_NAMES.indexOf(projName), ma = /^anim_projectile_(\d+)$/.exec(projName);
    if (ka >= 0 && ka < animOnly.length) return animOnly[ka];
    if (ma && Number(ma[1]) < animOnly.length) return animOnly[Number(ma[1])];
    return null;
}

export const projectilesCodec: Codec = {
    kind: KIND, version: 3, path: DIR, folder: `characters/${DIR}`, listedIdsOnly: true,

    defaultName: projectileDefaultName,

    // The fields are the record; README.md (what each field does) and an old tree's `what` are for the reader.
    canonical(path, bytes) {
        if (path === `${DIR}/${README}`) return null;
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes));
        delete v.what;
        return [path, json(v)];
    },

    explode(rom, name, _options, countOf, nameAt) {
        const files: Tree = new Map(), names: string[] = [], pool = [], homes = [];
        const words = routineWords(rom), addresses = tableOf(rom);
        if (new Set(addresses).size !== COUNT) throw new Error(`${DIR}: two ids share a record; explode would lose which`);
        for (let id = 0; id < COUNT; id++) names.push(name(KIND, id));
        const animOnly = allRecordAddrs().filter(a => !addresses.includes(a));
        for (const addr of allRecordAddrs()) {
            const tid = addresses.indexOf(addr);
            const n = tid >= 0 ? names[tid] : (nameAt(KIND, fileOf(addr)) ?? animProjectileName(animOnly.indexOf(addr)));
            const at = fileOf(addr), r = projectileRecord(rom, addr);
            const v: Record<string, unknown> = {};
            for (const [field, key, form] of FIELDS) v[field] = fieldText(rom, r[key], form, words, name, countOf, nameAt);
            files.set(`${DIR}/${n}.json`, json(v));
            pool.push({ start: at, end: at + PROJECTILE_STRIDE });
            homes.push({ key: `${DIR}/${n}`, at, length: PROJECTILE_STRIDE, sha1: sha1(rom.subarray(at, at + PROJECTILE_STRIDE)) });
        }
        files.set(`${DIR}/${README}`, new TextEncoder().encode(readme()));
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: COUNT, names, why: 'the table at $90:D986 (lda.l $90D986,x at $8C:E851, X = 2·id) holds 16 words; the 21 records follow at $90:D9A6-$DB9D (5 used only by animation scripts)' }));
        return { files, pool, tables: [{ start: TABLE, end: TABLE + 2 * COUNT }], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}` || path === `${DIR}/${README}`) continue;
            const m = /^projectiles\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a projectile is one <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const items: Item[] = [], words = routineWords(ctx.base.image), animRefs = new Map<string, string>();
        const addresses = tableOf(ctx.base.image);
        const allHomes = new Map([...ctx.base.homes].filter(([k]) => k.startsWith(`${DIR}/`)).map(([k, h]) => [k.slice(DIR.length + 1), h]));
        const claimed = new Set<number>();
        for (const n of names) {
            const own = allHomes.get(n);
            if (own) claimed.add(own.at);
        }
        const remainingHomes = [...allHomes.entries()].filter(([, h]) => !claimed.has(h.at)).map(([, h]) => h).sort((a, b) => a.at - b.at);
        const homeOf = (n: string) => {
            const own = allHomes.get(n);
            if (own) return own;
            const id = ctx.ids.get(KIND)?.get(n);
            if (id !== undefined && id < COUNT) {
                const targetAt = fileOf(addresses[id]);
                if (!claimed.has(targetAt)) {
                    const found = [...allHomes.values()].find(h => h.at === targetAt);
                    if (found) { claimed.add(found.at); return found; }
                }
            }
            const next = remainingHomes.find(h => !claimed.has(h.at));
            if (next) claimed.add(next.at);
            return next;
        };

        for (const n of [...names].sort()) {
            const path = `${DIR}/${n}.json`, key = `${DIR}/${n}`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: Record<string, unknown>;
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            const bytes = new Uint8Array(PROJECTILE_STRIDE);
            let ok = true;
            FIELDS.forEach(([field, , form], k) => {
                const raw = v[field];
                const w = fieldValue(raw, form, words, ctx);
                if (w === null) {
                    const isRef = form === 'attack_proc' || form === 'routine' || ((form === 'animation' || form === 'sprite_palette') && typeof raw === 'string' && !raw.startsWith('$'));
                    ctx.findings.error(isRef ? 'unknown-reference' : 'invalid-value', path, `/${field}`, expected(form));
                    ok = false;
                    return;
                }
                if (form === 'animation' && typeof raw === 'string' && !raw.startsWith('$')) animRefs.set(n, raw);
                bytes.set([w & 0xFF, w >> 8], 2 * k);
            });
            const home = homeOf(n);
            if (!home) { ctx.findings.error('no-room', path, '', `"${n}" has no record: the 21 records stay in bank $90 (which has no free byte for a new one); change an existing projectile instead`); continue; }
            // Pinned: only its home fits; `patched: true` lets tables() update moved/new animation offsets.
            if (ok) items.push({ key, file: path, bytes, rule: { above: home.at, below: home.at + PROJECTILE_STRIDE, bankOffset: home.at & 0xFFFF }, patched: true });
        }
        projAnimRefs.set(ctx, animRefs);
        return items;
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(KIND);
        if (!ids) return [];
        const table = new Uint8Array(2 * COUNT), byId = new Map([...ids].map(([n, id]) => [id, n]));
        const animRefs = projAnimRefs.get(ctx), writes: Write[] = [];
        for (let id = 0; id < COUNT; id++) {
            const n = byId.get(id), at = n === undefined ? undefined : placed.get(`${DIR}/${n}`);
            if (n === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no projectile has id ${id}; the table has no gaps`); continue; }
            if (at === undefined) continue;
            if (at >> 16 !== FILE_BANK) { ctx.findings.error('out-of-range', `${DIR}/${n}.json`, '', 'a record must lie in bank $90 (the table holds 16-bit addresses)'); continue; }
            table.set([at & 0xFF, (at >> 8) & 0xFF], 2 * id);
        }
        for (const [n, animName] of animRefs ?? []) {
            const at = placed.get(`${DIR}/${n}`);
            if (at === undefined) continue;
            const off = animationPlacedOffset(ctx, placed, animName);
            if (off !== null) writes.push({ at, bytes: Uint8Array.of(off & 0xFF, off >> 8), file: `${DIR}/${n}.json` });
        }
        return [{ at: TABLE, bytes: table, file: `${DIR}/${ENUM}` }, ...writes] satisfies Write[];
    },
};
