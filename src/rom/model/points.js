'use strict';
// Ownership: the curated names of ROM addresses that are points, not sized
// regions: routine entries and tables whose length nobody has measured.
// Data only. Carried over from the everscript wiki's ROM map (wiki/rom/Rom-Map.md);
// the wiki overlay (wiki-overlay.js) adds any the wiki gains later.
//
// Bus addresses as the game uses them. `cat` is the emoji category of the
// ROM map's legend: 🧠 code, 📋 table, ⚗️ alchemy, 📜 script.

const { FUNCTIONS, TABLES } = require('../../localizations');

const CODE = FUNCTIONS.map(f => [f.address, f.name]);
const TABLES_LIST = TABLES.filter(t => t.category === '📋' && t.address >= 0x800000 && t.address < 0xC00000).map(t => [t.address, t.name, t.notes || '']);

/** @returns {{bus:number, cat:string, name:string, notes:string}[]} */
function knownPoints() {
    return [
        ...CODE.map(([bus, name]) => ({ bus, cat: '🧠', name, notes: '' })),
        ...TABLES_LIST.map(([bus, name, notes]) => ({ bus, cat: '📋', name, notes })),
        { bus: 0xC45802, cat: '⚗️', name: 'Alchemy script pointer table', notes: '4 bytes/entry `[addr:16][bank:8][0]`; length not measured' },
        { bus: 0x92E0CA, cat: '📜', name: 'First intro code', notes: '`ADDRESS.INTRO_FIRST_CODE_EXECUTED`' },
    ];
}


module.exports = { knownPoints };
