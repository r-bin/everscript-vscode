'use strict';
// Ownership: which known ROM addresses the ROM tab marks as points (routine entries and tables whose
// length nobody has measured). The names are the knowledge entries' (localizations/knowledge/rom/,
// through functions.js / tables.js); this file only picks which of them are points.
//
// Bus addresses as the game uses them. `cat` is the entry's category: 🧠 code, 📋 table,
// ⚗️ alchemy, 📜 script.

const { FUNCTIONS, TABLES, getTable } = require('../../localizations');

/** @returns {{bus:number, cat:string, name:string, notes:string}[]} */
function knownPoints() {
    const tables = TABLES.filter(t => t.category === '📋' && t.address >= 0x800000 && t.address < 0xC00000);
    const alchemyScripts = getTable(0xC45802);   // the alchemy script pointers: 4 bytes per entry
    return [
        ...FUNCTIONS.map(f => ({ bus: f.address, cat: f.category, name: f.name, notes: f.category === '🧠' ? '' : f.notes })),
        ...tables.map(t => ({ bus: t.address, cat: '📋', name: t.name, notes: t.notes || '' })),
        ...(alchemyScripts ? [{ bus: alchemyScripts.address, cat: alchemyScripts.category, name: alchemyScripts.name, notes: alchemyScripts.notes }] : []),
    ];
}

module.exports = { knownPoints };
