'use strict';
// Ownership: ROM tables by address, as the rest of the plugin reads them. A view of the knowledge
// entries of kind `table` / `data` with a `category` (knowledge.js); write new facts as entries
// (`game-knowledge` skill), never here.

const { entries } = require('./knowledge');
const { resolveLocalizedName } = require('./strings');

/** { address, name, notes, category, size, stringIndex, id } per table (name = the entry's title). */
const TABLES = entries('rom')
    .filter(e => (e.kind === 'table' || e.kind === 'data') && e.category)
    .map(e => ({
        address: e.addr, name: e.title, notes: e.purpose === e.title + '.' ? '' : e.purpose,
        category: e.category, size: e.size, stringIndex: null, id: e.name, confidence: e.confidence,
    }));

// Entries use the bus address; callers also look up by file offset or the other mirror.
const TABLE_BY_OFFSET = new Map(TABLES.map(t => [t.address & 0x3FFFFF, t]));
const TABLE_BY_ADDRESS = new Map(TABLES.map(t => [t.address, t]));

function getTable(address) {
    if (typeof address !== 'number') return null;
    return TABLE_BY_ADDRESS.get(address) || TABLE_BY_OFFSET.get(address & 0x3FFFFF) || null;
}

function getTableName(address, options = {}) {
    const table = getTable(address);
    if (!table) return `Table $${address.toString(16).toUpperCase()}`;
    return resolveLocalizedName(table, options.rom, 'name');
}

module.exports = { TABLES, TABLE_BY_ADDRESS, getTable, getTableName };
