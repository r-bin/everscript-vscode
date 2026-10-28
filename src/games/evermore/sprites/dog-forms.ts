// Ownership: the Dog's forms — one animation set per act, plus the Prehistoria wolf
// carrying a stick — the Dog's counterpart of the Boy's weapons. Pure.
//
// Six 40-byte entries in bank $CF, listed by the pointer table at $CF945F. Each is a
// 10-byte header — a 24-bit pointer, the HUD portrait's 24-bit sprite (+3, $CC3Cxx: the loader
// copies it to $4FA5), the palette (+6, bank $90), a word — then 15 animation records. The loader is $8F:9471: it takes the entry from
// $8F:945D[form] (word 0 is no form, so form n is at $CF945F + 2n), writes +6 into the Dog's
// palette (+$09 of its WRAM record $0A70), +8 into +$13, and the records from +$0A into
// stand, walk, run (+$32..+$36), +$48, +$40, the attacks (+$38..+$3E), then $1443-$144D.


const FORM_POINTERS = 0xcf945f;
const FORM_BANK = 0xcf0000;
const HEADER = 10;
const SLOTS = 15;

/** In pointer-table order. Names from the slot records' ANIMATION_DOG ids, and the toaster's palette. */
const FORM_NAMES = [
    'Act 1 (Prehistoria)',
    'Act 1 with stick',
    'Act 2 (Antiqua)',
    'Act 3 (Gothica)',
    'Act 0 (Podunk)',
    'Act 4 (Omnitopia)',
];

/** Slot labels; null where nothing names the record yet. */
const SLOT_LABELS = [
    'Idle', 'Walk', 'Run', null, 'Knockback',
    'Attack Lvl 0', 'Attack Lvl 1', 'Attack Lvl 2', 'Attack Lvl 3',
    null, null, 'Sleep', 'Sit', null, 'Bark',
];

/** The Dog's record field each slot overwrites ($8F:9471); slots 9-14 go to $1443-$144D instead. */
const SLOT_FIELDS = [0x32, 0x34, 0x36, 0x48, 0x40, 0x38, 0x3a, 0x3c, 0x3e];

const SLOT_PURPOSES = [
    'idle', 'walk', 'run', null, 'knockback',
    'attack_0', 'attack_1', 'attack_2', 'attack_3',
    null, null, 'sleep', 'sit', null, 'bark',
];

import { busU16 as read16, busU8 as read8 } from '../../../platform';

/** One form's palette and animations, shaped like a Boy weapon for the tab. */
function readDogForm(rom: Uint8Array, index: number) {
    const entry = FORM_BANK | read16(rom, FORM_POINTERS + index * 2);
    const paletteAddr = read16(rom, entry + 6);
    const portrait = read16(rom, entry + 3) | (read8(rom, entry + 5) << 16);
    const anims = [];
    for (let s = 0; s < SLOTS; s++) {
        const animRec = read16(rom, entry + HEADER + s * 2);
        if (!animRec) continue;
        anims.push({
            key: 'd_slot' + s,
            label: SLOT_LABELS[s] || 'Slot ' + s,
            purpose: SLOT_PURPOSES[s] || null,
            animRec,
            category: 'weapon',
            paletteAddr,
            field: SLOT_FIELDS[s],
        });
    }
    return { id: index, name: FORM_NAMES[index], paletteAddr, portrait, entryHex: '$' + entry.toString(16), anims };
}

function readDogForms(rom: Uint8Array) {
    return FORM_NAMES.map((_, i) => readDogForm(rom, i));
}

/** How many forms there are (form request values 2, 4, … 2n). */
const DOG_FORM_COUNT = FORM_NAMES.length;

export { readDogForms, readDogForm, DOG_FORM_COUNT };
