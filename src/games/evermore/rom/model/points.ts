// Ownership: which known ROM addresses the ROM tab marks as points (routine entries and tables whose
// length nobody has measured). The names are the knowledge entries' (localizations/knowledge/rom/,
// through functions.ts / tables.js); this file only picks which of them are points.
//
// Bus addresses as the game uses them. `cat` is the entry's category: 🧠 code, 📋 table,
// ⚗️ alchemy, 📜 script.

import { FUNCTIONS, TABLES, getTable } from '../../localizations';

/** The known points: bus address, category (null for an uncategorised entry), name, notes. */
function knownPoints(): { bus: number; cat: string | null; name: string; notes: string }[] {
    const tables = TABLES.filter(t => t.category === '📋' && t.address >= 0x800000 && t.address < 0xC00000);
    const alchemyScripts = getTable(0xC45802);   // the alchemy script pointers: 4 bytes per entry
    return [
        ...FUNCTIONS.map(f => ({ bus: f.address, cat: f.category, name: f.name, notes: f.category === '🧠' ? '' : f.notes })),
        ...tables.map(t => ({ bus: t.address, cat: '📋', name: t.name, notes: t.notes || '' })),
        ...(alchemyScripts ? [{ bus: alchemyScripts.address, cat: alchemyScripts.category, name: alchemyScripts.name, notes: alchemyScripts.notes }] : []),
    ];
}

export { knownPoints };
