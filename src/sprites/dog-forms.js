'use strict';
// Ownership: the Dog's forms — one animation set per act, plus the Prehistoria wolf
// carrying a stick — the Dog's counterpart of the Boy's weapons. Pure.
//
// Six 40-byte entries in bank $CF, listed by the pointer table at $CF945F. Each is a
// 10-byte header — a 24-bit pointer, a byte, $CC3C, the palette (+6, bank $90), a word
// — then 15 animation records. The loader is not traced; the layout is read from the
// data, and a slot is named only where its record is one the Dog's own character record
// (+0x32..) or an ANIMATION_DOG id (via $C43C92) already names.

const { snesToRom } = require('../maps/dist/rom');

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

const read16 = (rom, snes) => {
    const o = snesToRom(snes);
    return rom[o] | (rom[o + 1] << 8);
};

/** One form's palette and animations, shaped like a Boy weapon for the tab. */
function readDogForm(rom, index) {
    const entry = FORM_BANK | read16(rom, FORM_POINTERS + index * 2);
    const paletteAddr = read16(rom, entry + 6);
    const anims = [];
    for (let s = 0; s < SLOTS; s++) {
        const animRec = read16(rom, entry + HEADER + s * 2);
        if (!animRec) continue;
        anims.push({
            key: 'd_slot' + s,
            label: SLOT_LABELS[s] || 'Slot ' + s,
            animRec,
            category: 'weapon',
            paletteAddr,
        });
    }
    return { id: index, name: FORM_NAMES[index], paletteAddr, entryHex: '$' + entry.toString(16), anims };
}

function readDogForms(rom) {
    return FORM_NAMES.map((_, i) => readDogForm(rom, i));
}

module.exports = { readDogForms };
