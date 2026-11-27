// The dog_forms kind (docs/open-evermore/resources.md §dog forms): the Dog's looks per act, one file each,
// characters/dog_forms/<form>.json, beside the Dog's one record (characters/records/dog.json: stats, behaviour, AI).
// A form is a 40-byte entry in bank $8F, read in place (records.mts): the loader $8F:9471 takes the entry from the
// pointer table $8F:945D (word 0 is "no form"; form n, request value 2·(n+1) in $2443, saved as $2363) and copies it
// into the Dog's record and $1443-$144D (knowledge routines/dog_load_form.md, wram/DOG_FORM_ANIM_9.md).
//
//   +0   the Dog's picture on its behaviour menu page, a 24-bit metasprite (0 for Act 0) → $143E
//   +3   the HUD portrait, a 24-bit metasprite ($CC:3Cxx) → $4FA5
//   +6   the palette (bank $90) → the Dog record's +$09
//   +8   a word → the Dog record's +$13 ($20; Act 4 $FA); its role is not read yet
//   +$0A 15 animation records (bank $C4): stand, walk, run, slot 3, knockback, attack 0-3 into the record
//        (+$32 +$34 +$36 +$48 +$40 +$38..+$3E), then slots 9-14 into $1443-$144D for the Dog's AI
//
// The entries are read with 16-bit offsets in bank $8F (`lda $8F0000,x`), so they stay where they are; the pointer
// table stays in _base/ (the count is fixed at 6 until a 7th form gets a hook: docs/open-evermore/extending.md §1).
import * as map from '../map.mts';
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
    { path: 'unknown_08', at: 8, stride: 0, form: { type: 'number' } },
    ...SLOTS.map((s, k): Field => ({ path: `animations/${s}`, at: 0x0A + 2 * k, stride: 0, form: { type: 'animation' } })),
];

const README = `# Dog forms

The Dog's looks, one file per form (\`$8F:945D\` order: a script asks for form n by writing 2·(n+1) to \`$2443\`).
Stats, behaviour and AI are the Dog's one record (\`characters/records/dog.json\`); only the Toaster's bonus is code.

| Field | What the game does with it |
|---|---|
| \`menu_sprite\` | the Dog's picture on its behaviour menu page (\`$143E\`); null: none (Act 0) |
| \`portrait\` | the HUD portrait beside the Dog's box (\`$4FA5\`) |
| \`palette\` | the 16 colours every pose of the form draws with (the Dog record's \`+$09\`) |
| \`unknown_08\` | copied to the Dog record's \`+$13\`; 32, Act 4 250; role not read |
| \`animations/stand\`, \`walk\`, \`run\` | standing, walking, running |
| \`animations/slot_3\` | Dog record \`+$48\`; reader not traced |
| \`animations/knockback\` | being hit |
| \`animations/attack_0\`…\`attack_3\` | the attack by charge level |
| \`animations/sniff\` | sniffing (\`$1443\`), when the Dog's \`+$64\` byte is clear |
| \`animations/sniff_look_around\` | sniffing when \`+$64\` is set, and the idle look-around (\`$1445\`) |
| \`animations/steered_still\` | standing while the player steers the Dog with no direction held (\`$1447\`) |
| \`animations/idle_wait\`, \`idle_wait_2\` | the idle cycle after 60-315 frames (\`$1449\`, \`$144B\`) |
| \`animations/slot_14\` | \`$144D\`: no code reads it |

Six forms, fixed: a 7th needs a hook first (docs/open-evermore/extending.md §1).
`;

export const dogFormsCodec = recordsCodec({
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
