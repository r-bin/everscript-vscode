// The alchemy kinds (docs/open-evermore/resources.md §alchemy): the 35 formulas, the 22 ingredients and the 10 formula
// levels. Parallel tables in bank $C4, one word (or byte) per formula, each read by `lda.l`/`and.l`/`ora.l table,x` with
// X = 2·formula (records.mts); implode writes every field where it was, so the count stays 35 (the tables touch each
// other, and the formulas' WRAM is packed: knowledge ALCHEMY_KNOWN_FLAGS, FORMULA_XP_*).
//
// Facts used (knowledge routines/ALCHEMY_*.md, v0.456.0 readers in the disassembly):
//   $C4:5D09 name (ring item text)      $C4:5BAF the formula's ring item      $C4:5D51 its description
//   $C4:5BF5 target cursor flags        $C4:5C3B / $5C81 the learned byte and bit ($8D, $91:CDxx)
//   $C4:5DDF the block: 2·k into $91:80A6 (53 words), which effect the cast plays ($91:A0CE); k 0-33 the formulas',
//            34-52 the Call Bead casts' ($C4:5F97). Laser has power 0 and Acid Rain's block (vanilla)
//   $C4:5E6B base power: its word is ORed with the level factor << 8 and stored to $4202 ($91:CCE6), so one byte
//   $C4:601F the cost, 4 bytes: ingredient 1, ingredient 2, count 1, count 2 (ingredient = index into $C4:5FF3, $22FF)
//   $C4:5B9C experience per cast by level (0-8, a byte), $C4:5BA5 the power factor by level (0-9, a byte)
// Names: the formulas' are menus.mts' (the compiler's ALCHEMY_INDEX order); ingredients from their ring item's text.
import { FORMULAS, nameRingItems } from './menus.mts';
import { recordsCodec, wramText } from './records.mts';

const GROUP = 'alchemy';
export const FORMULA_KIND = 'formulas', INGREDIENTS = 'ingredients', LEVELS = 'alchemy_levels';
const C4 = 0x040000, FORMULA_COUNT = 35, INGREDIENT_COUNT = 22, LEVEL_COUNT = 10;
const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

/** The blocks of $91:80A6 by index: the formula's own (index = the first formula using it), the Call Bead casts' by the
 *  spell they cast (spell_actions' names), the rest by number. */
const FORMULA_BLOCKS = ['cure', 'acid_rain', 'defend', 'flash', 'heal', 'levitate', 'speed', 'miracle_cure', 'hard_ball', 'drain',
    'crush', 'sting', 'atlas', 'revive', 'revealer', 'fireball', 'escape', 'double_drain', 'barrier', 'lance', 'corrosion',
    'fire_power', 'one_up', 'regrowth', 'explosion', 'lightning_storm', 'slow_burn', 'super_heal', 'stop', 'nitro', 'reflect',
    'call_up', 'energize', 'force_field'];
const CAST_BLOCKS: Record<number, string> = { 35: 'heat_wave', 36: 'storm', 40: 'confound', 45: 'plague', 47: 'disrupt' };
export const BLOCKS = Array.from({ length: 53 }, (_, k) => FORMULA_BLOCKS[k] ?? CAST_BLOCKS[k] ?? `block_${k}`);

/** Each table has its long-indexed reader (`lda.l`, `and.l`, `ora.l` table,x) in the ROM: the release is this one. */
function check(rom: Uint8Array): void {
    const ops = new Set([0xBF, 0x3F, 0x1F]);
    for (const t of [0x5D09, 0x5BAF, 0x5D51, 0x5DDF, 0x5E6B, 0x5BF5, 0x5C3B, 0x5C81, 0x601F, 0x5FF3, 0x5B9C, 0x5BA5]) {
        let found = false;
        for (let i = 0; i + 3 < rom.length && !found; i++) found = ops.has(rom[i]) && rom[i + 1] === (t & 0xFF) && rom[i + 2] === t >> 8 && rom[i + 3] === 0xC4;
        if (!found) throw new Error(`alchemy: nothing reads $C4:${t.toString(16).toUpperCase()} as this codec knows; another release?`);
    }
}

let INGREDIENT_NAMES: string[] = [];
function prepare(rom: Uint8Array): void {
    if (INGREDIENT_NAMES.length) return;
    const items = nameRingItems(rom), byText = new Map<number, string>();
    for (let id = 0x118 / 2; id <= 0x142 / 2; id++) byText.set(word(rom, 0x0E0000 | word(rom, 0x0E8000 + 2 * id)), items[id]);
    INGREDIENT_NAMES = Array.from({ length: INGREDIENT_COUNT }, (_, k) => (byText.get(word(rom, C4 + 0x5FF3 + 2 * k)) ?? `ingredient_${k}`).replace(/^ingredient_/, ''));
}

const cost = (k: 0 | 1) => [
    { path: `cost/${k}/ingredient`, at: C4 + 0x601F + k, stride: 4, width: 1 as const, form: { type: 'ref' as const, kind: INGREDIENTS } },
    { path: `cost/${k}/count`, at: C4 + 0x6021 + k, stride: 4, width: 1 as const, form: { type: 'number' as const } },
];

export const formulasCodec = recordsCodec({
    kind: FORMULA_KIND, group: GROUP, count: FORMULA_COUNT, names: () => FORMULAS,
    why: 'formula = id (2·id indexes nine tables in bank $C4 that touch each other); WRAM keeps 35 of each: learned bits $2258-$225C, experience $2F52, level $2F98, casts $2FDE (a word each)',
    fields: [
        { path: 'name', at: C4 + 0x5D09, stride: 2, form: { type: 'ring_text' } },
        { path: 'ring_item', at: C4 + 0x5BAF, stride: 2, form: { type: 'ref', kind: 'ring_items', scale: 2 } },
        { path: 'description', at: C4 + 0x5D51, stride: 2, form: { type: 'text' } },
        { path: 'block', at: C4 + 0x5DDF, stride: 2, form: { type: 'ref', names: BLOCKS, scale: 2 } },
        { path: 'power', at: C4 + 0x5E6B, stride: 2, form: { type: 'number', max: 0xFF } },
        { path: 'target', at: C4 + 0x5BF5, stride: 2, form: { type: 'hex' } },
        { path: 'learned/flags', at: C4 + 0x5C3B, stride: 2, form: { type: 'wram' } },
        { path: 'learned/bit', at: C4 + 0x5C81, stride: 2, form: { type: 'hex' } },
        ...cost(0), ...cost(1),
    ],
    notes: id => ({ wram: { experience: wramText(0x2F52 + 2 * id), level: wramText(0x2F98 + 2 * id), casts: wramText(0x2FDE + 2 * id) } }),
});

export const ingredientsCodec = recordsCodec({
    kind: INGREDIENTS, group: GROUP, count: INGREDIENT_COUNT, names: () => INGREDIENT_NAMES, prepare, check,
    why: 'ingredient = id: the name pointers at $C4:5FF3 (22 words, the cast names before them), the held count at $22FF + id',
    fields: [{ path: 'name', at: C4 + 0x5FF3, stride: 2, form: { type: 'ring_text' } }],
    notes: id => ({ held: wramText(0x22FF + id) }),
});

export const levelsCodec = recordsCodec({
    kind: LEVELS, group: GROUP, count: LEVEL_COUNT, names: () => Array.from({ length: LEVEL_COUNT }, (_, k) => `level_${k}`),
    why: 'a formula\'s level (0-9, $2F98 + 2·formula) indexes two byte tables: experience per cast at $C4:5B9C (levels 0-8; at 9 nothing is gained) and the power factor at $C4:5BA5',
    fields: [
        { path: 'experience_per_cast', at: C4 + 0x5B9C, stride: 1, width: 1, form: { type: 'number' }, ids: id => id < 9 },
        { path: 'power_factor', at: C4 + 0x5BA5, stride: 1, width: 1, form: { type: 'number' } },
    ],
    notes: () => ({ what: 'power = base power × power factor, split among the targets + 1, then 50-100 % of it (docs/alchemy-damage.md); 100 experience is a level' }),
});

export const ALCHEMY_KINDS = [ingredientsCodec, formulasCodec, levelsCodec];
