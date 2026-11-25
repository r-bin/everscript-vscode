// The targets kind (docs/open-evermore/resources.md §targets): what the target cursor may pick when a formula is cast or a
// consumable used. A target is a word of rules the caller stores to the request mask $05AD (knowledge TARGET_REQUEST_MASK)
// before `combat_target_selection_cursor_loop` ($8C:88CC); formulas ($C4:5BF5, `lda.l … : sta $05AD` in
// alchemy_cast_action_direct_targeting and _area_targeting) and consumables ($C4:5A84, item_use_on_target $8E:8CC0) store the same form, so both name one shared resource.
// The kind has no bytes of its own: a file is a set of rules by name, a formula or consumable names the file, and its
// codec writes the word (records.mts form `target`, items.mts). A new file is a new target; rules combine freely.
//
// Facts used (disassembly of $8C:8658-$8C:89DE, 2026-11-25):
//   target_candidate_filter $8C:8658: $0004 skips the on-screen test; $0800 / $0400 accept only the Boy / the Dog;
//     $4000 only entities whose record +$07 has bit 3; an entity with +$10 bit $4000 never; +$10 bit $0002 (friendly)
//     needs $0020 and record +$07 bit 2; +$10 bit $0004 needs $0008; any other needs $0010; HP 0 needs $1080, HP > 0 is
//     refused by $1000; +$10 bit $1000 needs $0040
//   combat_target_selection_cursor_loop $8C:88CC: $0200 starts on every valid entity and Left/Up/Right/Down cannot leave
//     it; $0002 lets the cursor step past the last (or first) valid entity to all of them; $0001 is the result (several),
//     $0100 set while a list is built (the name banner runs)
//   combat_target_list_build_enemies $8C:879B: with $2000 and four or more valid entities, the list keeps the three
//     nearest the Boy (|dx|² + |dy|² from $4EA3 / $4EA5)
import type { Codec, ImplodeContext } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText } from '../../tree.mts';
import { link, unlink } from '../../links.mts';

export const TARGETS = 'targets';
const DIR = TARGETS;

/** Each rule bit by name, in the order a target's name lists them (who, then life, then how many, then the rest). */
const RULES: [string, number][] = [
    ['boy', 0x0800], ['dog', 0x0400], ['party', 0x0008], ['enemies', 0x0010], ['marked_friends', 0x0020],
    ['record_bit_3_only', 0x4000], ['also_flag_1000', 0x0040],
    ['alive_or_dead', 0x0080], ['dead', 0x1000],
    ['or_all', 0x0002], ['all', 0x0200], ['nearest_three', 0x2000],
    ['off_screen_too', 0x0004], ['result_several', 0x0001], ['listing', 0x0100], ['bit_8000', 0x8000],
];
const BIT = new Map(RULES);
/** What each rule does, for the docs and the findings. */
export const RULE_WHAT: Record<string, string> = {
    boy: 'only the Boy', dog: 'only the Dog', party: 'entities whose +$10 has bit $0004 (the party members: Petals use it)',
    enemies: 'ordinary entities (no friendly bit): enemies', marked_friends: 'friendly entities whose character record +$07 has bit 2',
    record_bit_3_only: 'only entities whose character record +$07 has bit 3', also_flag_1000: 'entities whose +$10 has bit $1000 too (refused without it)',
    alive_or_dead: 'HP 0 may be picked too', dead: 'only HP 0', or_all: 'the cursor may step on to every valid entity at once',
    all: 'every valid entity at once, the cursor cannot leave it', nearest_three: 'all of them: only the three nearest the Boy when four or more',
    off_screen_too: 'no on-screen test', result_several: 'a result bit (several picked): the cursor writes it', listing: 'a result bit (a list is built): the builders write it',
    bit_8000: 'no reader known',
};

/** A target's name from its rules: the rule names joined, `nobody` for none. */
export function targetName(value: number): string {
    const parts = RULES.filter(([, b]) => value & b).map(([n]) => n);
    return parts.length ? parts.join('_') : 'nobody';
}
/** A name `targetName` gives back to its value (null for any other name). */
function parseName(name: string): number | null {
    if (name === 'nobody') return 0;
    let at = 0, value = 0;
    while (at < name.length) {
        const hit = RULES.map(([n]) => n).filter(n => name.startsWith(n, at) && (at + n.length === name.length || name[at + n.length] === '_'))
            .sort((a, b) => b.length - a.length)[0];
        if (!hit) return null;
        value |= BIT.get(hit)!; at += hit.length + 1;
    }
    return targetName(value) === name ? value : null;
}

/** A file's rules → the word, or why not. */
function valueOf(v: any): number | { error: string } {
    if (!Array.isArray(v?.rules)) return { error: 'the rules, a list of names: ' + RULES.map(([n]) => n).join(', ') };
    let value = 0;
    for (const r of v.rules) {
        const b = typeof r === 'string' ? BIT.get(r) : undefined;
        if (b === undefined) return { error: `"${r}" is no rule (${RULES.map(([n]) => n).join(', ')})` };
        value |= b;
    }
    return value;
}

/** Where the words are, per release check: who reads targets (records.mts, items.mts register them). */
type Source = (rom: Uint8Array) => number[];
const SOURCES: Source[] = [];
export const addTargetSource = (s: Source): void => { SOURCES.push(s); };

/** Every distinct word the ROM's sources hold, ascending. */
function valuesOf(rom: Uint8Array): number[] {
    return [...new Set(SOURCES.flatMap(s => s(rom)))].sort((a, b) => a - b);
}

/** The reference a field writes for word `value`. */
export const targetLink = (value: number): string => link(TARGETS, targetName(value));

/** A field's reference → the word its file holds (a name `targetName` gives, without a file, reads as its rules);
 *  null when it names nothing. */
export function targetValue(ctx: ImplodeContext | undefined, ref: unknown): number | null {
    const n = unlink(TARGETS, ref);
    if (n === undefined) return null;
    const bytes = ctx?.tree.get(`${DIR}/${n}.json`);
    if (bytes) { try { const v = valueOf(JSON.parse(readText(bytes))); return typeof v === 'number' ? v : null; } catch { return null; } }
    return parseName(n);
}

let LAST: number[] = [];

export const targetsCodec: Codec = {
    kind: TARGETS, version: 1, path: DIR, listedIdsOnly: true,
    defaultName: id => LAST[id] === undefined ? `target_${id}` : targetName(LAST[id]),

    // A target compares by its word (its name is the rules', and a hand-made name means the same word).
    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return null;
        const v = valueOf(JSON.parse(readText(bytes)));
        return typeof v === 'number' ? [`${DIR}/$${v.toString(16).padStart(4, '0')}`, json(v)] : [path, bytes];
    },

    // Names come from the rules, never from an enum: a word is the same target whatever file names it.
    explode(rom) {
        LAST = valuesOf(rom);
        const files = new Map<string, Uint8Array>(), names = LAST.map(targetName);
        LAST.forEach((v, k) => files.set(`${DIR}/${names[k]}.json`, json({ rules: RULES.filter(([, b]) => v & b).map(([n]) => n) })));
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: TARGETS, limit: 0, names: [], why: 'a target has no id: a formula or consumable names it and its codec writes the word ($05AD, knowledge TARGET_REQUEST_MASK); a file is its rules' }));
        return { files, pool: [], tables: [], homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^targets\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a target is one <name>.json; ignored');
        }
        return names;
    },

    // Checks the files; formulas and consumables write the words.
    encode({ tree, findings }, names) {
        for (const n of names) {
            const file = `${DIR}/${n}.json`;
            if (!NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: unknown;
            try { v = valueOf(JSON.parse(readText(tree.get(file)!))); } catch (e) { findings.error('parse-error', file, '', (e as Error).message); continue; }
            if (typeof v !== 'number') findings.error('invalid-value', file, '/rules', (v as { error: string }).error);
        }
        return [];
    },

    tables: () => [],
};
