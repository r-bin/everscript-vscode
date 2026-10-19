// Ownership: ROM tables by address, as the rest of the plugin reads them. A view of the knowledge
// entries of kind `table` / `data` with a `category` (knowledge.ts); write new facts as entries
// (`game-knowledge` skill), never here.

import { entries } from './knowledge';
import { resolveLocalizedName } from './strings';
import type { NameOptions } from './strings';
import { hiromFileOffset } from '../../../platform/snes/hirom';

/** { address, name, notes, category, size, stringIndex, id } per table (name = the entry's title). */
const TABLES = entries('rom')
    .filter(e => (e.kind === 'table' || e.kind === 'data') && e.category)
    .map(e => ({
        address: e.addr, name: e.title, notes: e.purpose === e.title + '.' ? '' : e.purpose,
        category: e.category, size: e.size, stringIndex: null, id: e.name, confidence: e.confidence,
    }));

// Entries use the bus address; callers also look up by file offset or the other mirror.
const TABLE_BY_OFFSET = new Map(TABLES.map(t => [hiromFileOffset(t.address), t]));
const TABLE_BY_ADDRESS = new Map(TABLES.map(t => [t.address, t]));

function getTable(address: unknown) {
    if (typeof address !== 'number') return null;
    return TABLE_BY_ADDRESS.get(address) || TABLE_BY_OFFSET.get(hiromFileOffset(address)) || null;
}

function getTableName(address: number, options: NameOptions = {}): string {
    const table = getTable(address);
    if (!table) return `Table $${address.toString(16).toUpperCase()}`;
    return resolveLocalizedName(table, options.rom, 'name');
}

export { TABLES, TABLE_BY_ADDRESS, getTable, getTableName };
