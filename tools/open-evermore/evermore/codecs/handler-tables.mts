// Kinds that are a jump table of routines a record picks by an even id (docs/open-evermore/resources.md §attack
// procs, behaviours): one file per entry, <kind>/<name>.json, its handler by routine name (readers.mts `routines`)
// and what it does for the reader; <kind>/_enum.json names[id], where a record holds 2·id. Implode writes the table in
// place: each is read by an indexed jump in its own bank and has code right after it, so it can neither move nor grow.
// Characters reference attack procs and behaviours by name (characters.mts), scripts the animation modes.
//
// Facts used:
//   attack procs  $8F:B6AE, JSR ($B6AE,x) in the contact handler ($8F:B57B) and the strike hit test ($8F:B6A5), X =
//                 record +$30 (or the projectile's $0E9A); 15 words, then the first handler ($8F:B6CC). What each
//                 does: knowledge routines/g_attack_proc_table.md (decoded v0.340.1)
//   behaviours    $8F:CBE0, JMP ($CBE0,x) at $8F:CD17, X = record +$03, read on every idle tick; 15 words
//                 (docs/entities/ai-behaviours.md)
//   animation modes  $8C:E100, JMP ($E100,x) at $8C:E0FD, X = animate()'s mode expression; 6 words, code from $8C:E10C
//                 (knowledge routines/SCRIPT_ANIMATE_MODE_TARGETS.md). Scripts write the mode by name (type animation_mode)
// Names: ours, from what each does (attack procs: the decoded table; behaviours: the IDLE_BEHAVIOR names the
// compiler and the Data tab already use; animation modes: the compiler's ANIMATION_MODE names, lowercased).
import type { Codec, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { routines } from './readers.mts';

interface Table {
    kind: string;
    /** File offset of the table; its bank is the handlers' bank. */
    at: number;
    /** [name, what it does] per id. */
    entries: [string, string][];
    why: string;
    /** The group folder (default characters). */
    group?: string;
}

export function handlerTable(t: Table): Codec {
    const DIR = t.kind, BANK = 0x80 | (t.at >> 16), COUNT = t.entries.length, HANDLERS = routines(BANK);
    const bank = `$${BANK.toString(16).toUpperCase()}`;
    return {
        kind: t.kind, version: 1, path: DIR, folder: `${t.group ?? 'characters'}/${DIR}`,
        defaultName: id => t.entries[id]?.[0] ?? `${t.kind}_${(2 * id).toString(16).padStart(2, '0')}`,

        // Only the handler is the entry; `what` is for the reader.
        canonical(path, bytes) {
            if (path === `${DIR}/${ENUM}`) return [path, bytes];
            return [path, json({ handler: JSON.parse(readText(bytes)).handler })];
        },

        explode(rom, name) {
            const files: Tree = new Map(), names: string[] = [];
            for (let id = 0; id < COUNT; id++) {
                const n = name(t.kind, id), h = rom[t.at + 2 * id] | (rom[t.at + 2 * id + 1] << 8);
                names.push(n);
                files.set(`${DIR}/${n}.json`, json({ handler: HANDLERS.name(h), what: t.entries[id]?.[1] }));
            }
            files.set(`${DIR}/${ENUM}`, enumFile({ kind: t.kind, limit: COUNT, names, why: t.why }));
            return { files, pool: [], tables: [{ start: t.at, end: t.at + 2 * COUNT }], homes: [] };
        },

        names({ tree, findings }) {
            const names = new Set<string>();
            for (const path of tree.keys()) {
                if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
                const m = new RegExp(`^${DIR}/([^/]+)\\.json$`).exec(path);
                if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', `an entry is one <name>.json; ignored`);
            }
            return names;
        },

        encode(ctx, names) {
            for (const n of names) {
                const path = `${DIR}/${n}.json`;
                if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
                try {
                    const v = JSON.parse(readText(ctx.tree.get(path)!));
                    if (HANDLERS.at(v.handler) === null) ctx.findings.error('unknown-reference', path, '/handler', `"${v.handler}" is no routine of bank ${bank} (the table's jump stays in its bank); a routine's name (soe://rom/code/) or "${bank}:xxxx"`);
                } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); }
            }
            return [];
        },

        tables(ctx) {
            const ids = ctx.ids.get(t.kind);
            if (!ids) return [];
            const table = new Uint8Array(2 * COUNT), byId = new Map([...ids].map(([n, id]) => [id, n]));
            for (let id = 0; id < COUNT; id++) {
                const n = byId.get(id);
                if (n === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no entry has id ${id}; the table has no gaps`); continue; }
                const h = HANDLERS.at(JSON.parse(readText(ctx.tree.get(`${DIR}/${n}.json`)!)).handler);
                if (h !== null) table.set([h & 0xFF, h >> 8], 2 * id);
            }
            return [{ at: t.at, bytes: table, file: `${DIR}/${ENUM}` }] satisfies Write[];
        },
    };
}

export const ATTACK_PROCS = 'attack_procs', BEHAVIOURS = 'behaviours', ANIMATION_MODES = 'animation_modes';

export const attackProcsCodec = handlerTable({
    kind: ATTACK_PROCS, at: 0x0FB6AE,
    why: 'the contact handler table at $8F:B6AE (JSR ($B6AE,x), handlers in bank $8F) holds 15 entries and has code right after it; a character record holds 2·id at +$30',
    entries: [
        ['melee', 'to-hit roll, damage, apply (knockback, shield halving, 999 cap), retaliation'],
        ['projectile', 'a projectile hits (targets with flags2 bit 4 are immune), damage from its power $0E9C; the projectile is removed; a kill by the Boy or the Dog gives skill'],
        ['projectile_piercing', 'as projectile, but the projectile stays'],
        ['projectile_ignoring_defence', 'as projectile, damage without the defence'],
        ['melee_boy_skill', 'melee; a kill raises the Boy\'s weapon skill'],
        ['melee_dog_skill', 'melee; a kill raises the Dog\'s attack skill'],
        ['melee_swallow', 'melee, then the attacker plays its swallow animation unless the target resists (the flowers)'],
        ['melee_unless_incense', 'nothing while insect incense is on; otherwise melee without knockback, halving or cap'],
        ['melee_no_knockback', 'melee without knockback, shield halving or damage cap'],
        ['melee_poison_1_in_4', 'melee, then 1 in 4 poisons'],
        ['melee_poison_1_in_4_unless_incense', 'as melee_poison_1_in_4, nothing while insect incense is on'],
        ['melee_plague_1_in_8', 'melee, then 1 in 8 plague at power 5'],
        ['melee_poison', 'melee, then always poison'],
        ['damage_without_roll', 'no to-hit roll: damage from $0E9C, applied'],
        ['melee_plague_or_confound_1_in_4', 'melee, then 1 in 4 plague (power 5) or confound, even odds'],
    ],
});

export const behavioursCodec = handlerTable({
    kind: BEHAVIOURS, at: 0x0FCBE0,
    why: 'the behaviour table at $8F:CBE0 (JMP ($CBE0,x) at $8F:CD17, routines in bank $8F) holds 15 entries; a character record holds 2·id at +$03',
    entries: [
        ['chase', 'pursues its target, lines up within reach and strikes; backs off while recharging'],
        ['none', 'idles; moved only by scripts'],
        ['companion_boy', 'the Boy when the player controls the Dog: follows and fights by the AI menu'],
        ['companion_dog', 'the Dog when the player controls the Boy: follows, sniffs, sits'],
        ['stationary', 'stays put, faces four ways, strikes within reach'],
        ['wander', 'townsfolk: walks a little, pauses'],
        ['chase_hovering', 'chases in the air, bobbing'],
        ['stationary_player', 'a turret that follows the player in eight directions'],
        ['roll_or_shoot', 'at full charge shoots or curls up and rolls at its target'],
        ['chase_or_roll', 'chases; half the time a rolling charge'],
        ['bounce', 'walks on, bouncing off walls; never attacks'],
        ['drift_east', 'drifts east, leaning north or south'],
        ['pursue_player', 'pursues when charged, retreats when not'],
        ['roll', 'rolls at its target at full charge'],
        ['stationary_diagonal', 'stays put facing diagonally, strikes within reach'],
    ],
});

/** animate()'s modes: the table's six entries. */
export const ANIMATION_MODE_COUNT = 6;

export const animationModesCodec = handlerTable({
    kind: ANIMATION_MODES, at: 0x0CE100,
    why: "animate()'s mode is 2·id into the table at $8C:E100 (JMP ($E100,x) at $8C:E0FD, handlers in bank $8C), 6 entries with code right after them; every handler ends in the animation start $8C:E139",
    entries: [
        ['once', 'plays the animation, nothing more'],
        ['once_freeze', 'sets entity +$12 bit $0200, then plays'],
        ['loop', 'sets entity +$12 bit $0100 (end_check restarts the script), then plays'],
        ['freeze', 'sets entity +$10 bit $2000 (hides after a fall: gravity turns it into $0001), then plays'],
        ['clear_script_pointers', 'clears the words at entity +$01 and +$03 (resume and restart pointers), then plays; vanilla: the skeleton ship in the Desert of Doom'],
        ['pause', 'sets entity +$10 bit $0001 (hidden and paused), then plays'],
    ],
});
