// The dog_forms kind (docs/open-evermore/resources.md §dog forms): the Dog's looks per act, one file each,
// characters/dog_forms/<form>.json, beside the Dog's one record (characters/records/dog.json: stats, behaviour, AI).
// A form is a 40-byte entry in bank $8F, read in place (records.mts): the loader $8F:9471 takes the entry from the
// pointer table $8F:945D (word 0 is "no form"; form n, request value 2·(n+1) in $2443, saved as $2363) and copies it
// into the Dog's record and $1443-$144D (knowledge routines/dog_load_form.md, wram/DOG_FORM_ANIM_9.md).
//
//   +0   the Dog's picture on its behaviour menu page, a 24-bit metasprite (0 for Act 0) → $143E
//   +3   the HUD portrait, a 24-bit metasprite ($CC:3Cxx) → $4FA5
//   +6   the palette (bank $90) → the Dog record's +$09
//   +8   the attack reach in pixels → the Dog record's +$13 (`aggro_range`): $20, Act 4 (shots) $FA. The companion
//        AI attacks when its target is lined up within it ($8F:D9D1, called from $8F:D0B0)
//   +$0A 15 animation records (bank $C4): stand, walk, run, slot 3, knockback, attack 0-3 into the record
//        (+$32 +$34 +$36 +$48 +$40 +$38..+$3E), then slots 9-14 into $1443-$144D for the Dog's AI
//
// The loader reads the pointer table with one long operand (`lda.l $8F945D,x`, $8F:9477) and the entry with 21 long
// reads `lda.l $8F00xx,x` (X the entry's 16-bit offset): with six forms all stays in place and in _base/. A 7th form and
// more (docs/open-evermore/extending.md §1, built 2026-11-28) move all of it into a generated block in one bank:
//   the pointer table (word 0 "no form", then one word per form); every form's 40-byte entry (vanilla's six copied from
//   their homes, as edited); and the three other tables read by the form number (word 0 unused):
//     $80:BF0E (read at $80:BF01) the Windwalker flight's Dog palette: a new form flies in its own `palette`
//     $80:C707 (read at $80:C6F9) the flight's Dog animation: a new form flies with its `animations/stand`
//     $8E:B512 (read at $8E:B4AA) the Dog's equipment ring entry of $C4:5A75: a new form shows entry 0 (as Act 0 does)
//   Implode rewrites the pointer read's operand, the 21 entry reads' bank byte and the three reads' operands: the same
//   instructions, the same length and cycles, no hook (a copy of the loader would also copy operands other kinds own,
//   such as its WRAM addresses, which _base/ holds blank). Vanilla's rows are copied byte for byte, the Toaster's
//   past-the-end words included. With six forms every one of those bytes is vanilla's again.
import * as map from '../map.mts';
import type { Codec, ImplodeContext, Span, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { DOG_FORM_NAMES } from './dog-form-names.mts';
import { recordsCodec } from './records.mts';
import type { Field } from './records.mts';

export const DOG_FORMS = 'dog_forms';
const POINTERS = map.file('dog_forms.pointers'), ENTRIES = map.files('dog_forms.entries');

/** The 15 slots in entry order, named by the code that reads them (extending.md §2). */
const SLOTS = [
    'stand', 'walk', 'run', 'slot_3', 'knockback', 'attack_0', 'attack_1', 'attack_2', 'attack_3',
    'sniff', 'sniff_look_around', 'steered_still', 'idle_wait', 'idle_wait_2', 'slot_14',
] as const;

const fields: Field[] = [
    { path: 'menu_sprite', at: 0, stride: 0, width: 3, form: { type: 'metasprite', optional: true } },
    { path: 'portrait', at: 3, stride: 0, width: 3, form: { type: 'metasprite' } },
    { path: 'palette', at: 6, stride: 0, form: { type: 'sprite_palette' } },
    { path: 'aggro_range', at: 8, stride: 0, form: { type: 'number' } },
    ...SLOTS.map((s, k): Field => ({ path: `animations/${s}`, at: 0x0A + 2 * k, stride: 0, form: { type: 'animation' } })),
];

const README = `# Dog forms

The Dog's looks, one file per form (\`$8F:945D\` order: a script asks for form n by writing 2·(n+1) to \`$2443\`).
Stats, behaviour and AI are the Dog's one record (\`characters/records/dog.json\`), except the attack reach, which each
form sets (\`aggro_range\`); the Toaster's +80/+250 bonus is code.

| Field | What the game does with it |
|---|---|
| \`menu_sprite\` | the Dog's picture on its behaviour menu page (\`$143E\`); null: none (Act 0) |
| \`portrait\` | the HUD portrait beside the Dog's box (\`$4FA5\`) |
| \`palette\` | the 16 colours every pose of the form draws with (the Dog record's \`+$09\`) |
| \`aggro_range\` | the attack reach in pixels, written over the Dog record's \`aggro_range\` (\`+$13\`) when the form loads: the companion AI attacks its target once it is lined up within this distance on one axis (and within half the target's radius + 5 across it). 32 for the biting forms, 250 for Act 4, whose attacks fire shots. The Boy's weapons set the same field for the Boy (\`range\`) |
| \`animations/stand\`, \`walk\`, \`run\` | standing, walking, running |
| \`animations/slot_3\` | Dog record \`+$48\`; reader not traced |
| \`animations/knockback\` | being hit |
| \`animations/attack_0\`…\`attack_3\` | the attack by charge level |
| \`animations/sniff\` | sniffing (\`$1443\`, the player holds R), when the Dog's \`+$64\` byte is clear: an in-place animation with a nose-down pose (vanilla moves no step) |
| \`animations/sniff_look_around\` | sniffing when \`+$64\` is set, and the idle look-around (\`$1445\`): a walking animation (\`mode walk\`, steps), or the Dog stays put |
| \`animations/steered_still\` | standing while the player steers the Dog with no direction held (\`$1447\`) |
| \`animations/idle_wait\`, \`idle_wait_2\` | the idle cycle after 60-315 frames (\`$1449\`, \`$144B\`) |
| \`animations/slot_14\` | \`$144D\`: no code reads it |

A 7th form and more: add a file (copy a sibling) and its name to \`_enum.json\`; implode then moves the entries, the pointer table and the
three tables the form number picks into one generated block. A new form flies the Windwalker in its \`palette\` with its
\`animations/stand\`, and the equipment ring shows it entry 0 (as Act 0). Scripts ask for form n (0-based, in
\`_enum.json\` order) by writing 2·(n+1) to \`$2443\` (\`ROOM_METATILE_DESCRIPTOR_PTR\`, an old wrong name).
`;

const vanillaCodec = recordsCodec({
    kind: DOG_FORMS, group: 'characters', count: ENTRIES.length, names: () => DOG_FORM_NAMES, fields,
    entryAt: id => ENTRIES[id], readme: README,
    why: 'six 40-byte entries in bank $8F by the pointer table $8F:945D, read in place by form number',
    // The pointer table (in _base/) must name these entries: an edited form must explode again, so not its fields.
    check: rom => {
        const word = (at: number) => rom[at] | (rom[at + 1] << 8);
        if (word(POINTERS)) throw new Error('dog_forms: $8F:945D does not start with "no form"; another release?');
        ENTRIES.forEach((at, k) => {
            if (word(POINTERS + 2 + 2 * k) !== (at & 0xFFFF))
                throw new Error(`dog_forms: $8F:945D form ${k} does not point at $${(at & 0xFFFF).toString(16)}; another release?`);
        });
    },
});

// ── growth: a 7th form and more ──
const VANILLA = ENTRIES.length, ENTRY = 40, LIMIT = 64;
/** `lda.l $8F945D,x` (the pointer table) and the 21 `lda.l $8F00xx,x` (an entry's bytes) in the loader. */
const POINTER_READ = map.file('dog_forms.pointer_read'), ENTRY_READS = map.files('dog_forms.entry_reads');
const VANILLA_POINTERS = map.bus('dog_forms.pointers'), ENTRY_BANK = VANILLA_POINTERS >> 16;
const SIDES = [
    { read: map.file('dog_forms.flight_palette_read'), table: map.bus('dog_forms.flight_palettes') },
    { read: map.file('dog_forms.flight_animation_read'), table: map.bus('dog_forms.flight_animations') },
    { read: map.file('dog_forms.equipment_read'), table: map.bus('dog_forms.equipment_entries') },
];
const KEY = `${DOG_FORMS}/_grown`;
const le24 = (v: number) => [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF];
const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const fileOf = (bus: number) => bus & 0x3FFFFF;

/** The generated block's layout for `n` forms (offsets in it; the pointer table first). */
function layout(n: number) {
    const entries = 2 * (n + 1), sides = entries + ENTRY * n;
    return { pointers: 0, entries, sides: SIDES.map((_, k) => sides + 2 * (n + 1) * k), length: sides + 2 * (n + 1) * SIDES.length };
}

/** The operand bytes a grown kind rewrites, with vanilla's. */
const SITES = new Map<number, number[]>([
    [POINTER_READ + 1, le24(VANILLA_POINTERS)],
    ...ENTRY_READS.map(r => [r + 3, [ENTRY_BANK]] as [number, number[]]),
    ...SIDES.map(s => [s.read + 1, le24(s.table)] as [number, number[]]),
]);
const SPANS: Span[] = [...SITES].map(([at, b]) => ({ start: at, end: at + b.length }));

/** A records codec for the forms from the 7th on, `entryAt` giving where each one's 40 bytes are. */
const extraCodec = (count: number, entryAt: (id: number) => number, names: () => readonly string[]) => recordsCodec({
    kind: DOG_FORMS, group: 'characters', count, names, fields, entryAt, why: 'the forms past vanilla\'s six',
});

/** The grown form of a ROM implode built: the block's file offset and its form count, or null for vanilla's. */
function grownIn(rom: Uint8Array): { block: number; n: number } | null {
    const pointers = u24(rom, POINTER_READ + 1);
    if (pointers === VANILLA_POINTERS) return null;
    const block = fileOf(pointers), first = (block & 0x3F0000) | u16(rom, block + 2);
    return { block, n: (first - block) / 2 - 1 };
}

function grow(inner: Codec): Codec {
    const DIR = inner.path;
    const vanillaIds = (ctx: ImplodeContext) => new Map([...(ctx.ids.get(DOG_FORMS) ?? [])].filter(([, id]) => id < VANILLA));
    /** The new forms by id from 6, in order; null when there are none, or an id is missing (an error says which). */
    function extras(ctx: ImplodeContext): string[] | null {
        const ids = ctx.ids.get(DOG_FORMS);
        if (!ids) return null;
        const count = Math.max(VANILLA, ...[...ids.values()].map(id => id + 1));
        if (count === VANILLA) return null;
        const byId = new Map([...ids].map(([n, id]) => [id, n])), out: string[] = [];
        for (let id = VANILLA; id < count; id++) {
            const n = byId.get(id);
            if (n === undefined) { ctx.findings.error('missing-file', `${DIR}/${ENUM}`, `/names/${id}`, `form numbers are a list: no gap (id ${id} is missing)`); return null; }
            out.push(n);
        }
        return out;
    }
    const withIds = (ctx: ImplodeContext, ids: Map<string, number>): ImplodeContext => ({ ...ctx, ids: new Map(ctx.ids).set(DOG_FORMS, ids) });
    const extraIds = (names: string[]) => new Map(names.map((n, k) => [n, k]));

    return {
        ...inner,

        explode(rom, name, options, countOf, nameAt) {
            const g = grownIn(rom);
            for (const [at, b] of SITES)
                if (!g && !b.every((x, k) => rom[at + k] === x)) throw new Error(`dog_forms: $${(0xC00000 | at).toString(16).toUpperCase()} is not the code this codec knows; another release?`);
            if ([POINTER_READ, ...ENTRY_READS].some(r => rom[r] !== 0xBF) || ENTRY_READS.some(r => rom[r + 1] >= ENTRY || rom[r + 2] !== 0))
                throw new Error('dog_forms: the loader at $8F:9471 does not read its entry with `lda.l $8F00xx,x`; another release?');
            const out = inner.explode(rom, name, options, countOf, nameAt);
            const names = Array.from({ length: VANILLA }, (_, id) => name(DOG_FORMS, id));
            if (g && g.n > VANILLA) {
                const pointers = g.block + layout(g.n).pointers, bank = g.block & 0x3F0000;
                const extra = Array.from({ length: g.n - VANILLA }, (_, k) => name(DOG_FORMS, VANILLA + k));
                const x = extraCodec(extra.length, id => bank | u16(rom, pointers + 2 * (VANILLA + id + 1)), () => extra)
                    .explode(rom, (kind, id) => kind === DOG_FORMS ? extra[id] : name(kind, id), options, countOf, nameAt);
                for (const [p, b] of x.files) if (p.startsWith(`${DIR}/`) && p !== `${DIR}/${ENUM}`) out.files.set(p, b);
                names.push(...extra);
            }
            out.files.set(`${DIR}/${ENUM}`, enumFile({ kind: DOG_FORMS, limit: LIMIT, names, why: `form n is request value 2·(n+1) in $2443; the six vanilla entries are read in place in bank $8F, a 7th and more move them, the pointer table and the three tables the form number picks into a generated block in one bank and point the loader there (dog-forms.mts; the limit is ours)` }));
            out.tables.push(...SPANS);
            return out;
        },

        encode(ctx, names) {
            const items = inner.encode(withIds(ctx, vanillaIds(ctx)), new Set([...names].filter(n => (ctx.ids.get(DOG_FORMS)?.get(n) ?? 0) < VANILLA)));
            const extra = extras(ctx);
            if (!extra) return items;
            items.push(...extraCodec(extra.length, () => 0, () => extra).encode(withIds(ctx, extraIds(extra)), new Set(extra)));
            const n = VANILLA + extra.length;
            items.push({ key: KEY, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(layout(n).length), rule: map.rule('grown_tables'), generated: true });
            return items;
        },

        tables(ctx, placed) {
            const ids = ctx.ids.get(DOG_FORMS);
            if (!ids) return [];
            const writes = inner.tables(withIds(ctx, vanillaIds(ctx)), placed);
            const file = `${DIR}/${ENUM}`, extra = extras(ctx), at = placed.get(KEY);
            const put = (where: number, bytes: number[]) => writes.push({ at: where, bytes: Uint8Array.from(bytes), file });
            if (!extra || at === undefined) {
                for (const [where, b] of SITES) put(where, b);
                return writes;
            }
            const n = VANILLA + extra.length, l = layout(n), bus = (o: number) => ctx.pointer(o), bank = bus(at) >> 16;
            // Every form's 40 bytes: vanilla's six from the writes at their homes, the new ones' at a scratch offset.
            const entries = Array.from({ length: n }, () => new Uint8Array(ENTRY));
            const apply = (w: Write, start: number, e: Uint8Array) => { for (let k = 0; k < w.bytes.length; k++) { const o = w.at + k - start; if (o >= 0 && o < ENTRY) e[o] = w.bytes[k]; } };
            for (const w of writes) ENTRIES.forEach((home, k) => apply(w, home, entries[k]));
            const SCRATCH = 0x10000000;
            for (const w of extraCodec(extra.length, id => SCRATCH + ENTRY * id, () => extra).tables(withIds(ctx, extraIds(extra)), placed))
                extra.forEach((_, k) => apply(w, SCRATCH + ENTRY * k, entries[VANILLA + k]));
            const block = new Uint8Array(l.length);
            entries.forEach((e, k) => {
                const where = bus(at + l.entries + ENTRY * k) & 0xFFFF;
                block[l.pointers + 2 * (k + 1)] = where & 0xFF; block[l.pointers + 2 * (k + 1) + 1] = where >> 8;
                block.set(e, l.entries + ENTRY * k);
            });
            // The three side tables: vanilla's rows as the game reads them, the new forms' from their entries.
            SIDES.forEach((s, t) => {
                for (let k = 0; k < n; k++) {
                    const o = l.sides[t] + 2 * (k + 1);
                    if (k < VANILLA) { const src = fileOf(s.table) + 2 * (k + 1); block[o] = ctx.base.image[src]; block[o + 1] = ctx.base.image[src + 1]; continue; }
                    const e = entries[k], v = t === 0 ? u16(e, 6) : t === 1 ? u16(e, 0x0A) : 0;
                    block[o] = v & 0xFF; block[o + 1] = v >> 8;
                }
            });
            put(at, [...block]);
            // The loader reads the block's pointer table and the entries in its bank; the three reads its tables.
            put(POINTER_READ + 1, le24(bus(at + l.pointers)));
            ENTRY_READS.forEach(r => put(r + 3, [bank]));
            SIDES.forEach((s, t) => put(s.read + 1, le24(bus(at + l.sides[t]))));
            ctx.findings.info('grown', file, '', `${n} Dog forms: the entries and their tables moved to $${bus(at).toString(16).toUpperCase()} (form ${n - 1} is request value $${(2 * n).toString(16).toUpperCase()} in $2443)`);
            return writes;
        },
    };
}

export const dogFormsCodec = grow(vanillaCodec);
