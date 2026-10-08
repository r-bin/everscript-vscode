'use strict';
// Ownership: ROM table addresses to subjective table names and descriptions.
// Sources: everscript wiki ROM map, src/rom/model/points.js, catalog.js, audio.js.

const { resolveLocalizedName } = require('./strings');

const TABLES = [
    // Engine lookup and jump tables (points.js)
    { address: 0x8088A3, name: 'Orbit table (y)', notes: 'angle → y, boomerang ellipse', category: '📋', stringIndex: null },
    { address: 0x808923, name: 'Orbit table (x)', notes: 'angle → x', category: '📋', stringIndex: null },
    { address: 0x8C98A1, name: 'Decompressor jump table', notes: '8 methods; 0x00 raw, 0x03 LZSS, 0x07 Markov', category: '📋', stringIndex: null },
    { address: 0x8F0000, name: 'Hit-chance table base', notes: 'indexed via $8F:BAAF', category: '📋', stringIndex: null },
    { address: 0x8FBAAF, name: 'Hit-chance pointers by evade', notes: '', category: '📋', stringIndex: null },
    { address: 0x8FAF18, name: 'Mover direction table', notes: '', category: '📋', stringIndex: null },
    { address: 0x8FB090, name: 'Step dither 3,2,0,1', notes: '', category: '📋', stringIndex: null },
    { address: 0x8FCA50, name: 'Segment ease: velocity share', notes: '', category: '📋', stringIndex: null },
    { address: 0x8FCB18, name: 'Segment ease: distance share', notes: '', category: '📋', stringIndex: null },
    { address: 0x908E74, name: 'Room effect jump table', notes: 'header byte 8', category: '📋', stringIndex: null },
    { address: 0x90815B, name: 'Facing → pose table', notes: '4-pose records', category: '📋', stringIndex: null },
    { address: 0x90D967, name: 'Projectile movement routines', notes: '', category: '📋', stringIndex: null },
    { address: 0x90DD88, name: 'Projectile velocity by facing', notes: '', category: '📋', stringIndex: null },
    { address: 0x91AE31, name: 'Status effect apply / remove dispatch', notes: '8 status slots, masks, durations', category: '📋', stringIndex: null },
    { address: 0x90B00B, name: 'Default Boy palette', notes: '', category: '📋', stringIndex: null },

    // Alchemy master tables ($C4)
    { address: 0x045B9C, name: 'Formula XP per cast', notes: '[10,5,4,3,2,2,1,1,1] Lv0..8', category: '⚗️', stringIndex: null },
    { address: 0x045BA5, name: 'Level multiplier', notes: '[2,4,7,11,15,20,26,32,39,46] Lv0..9', category: '⚗️', stringIndex: null },
    { address: 0x045BF5, name: 'ALCHEMY_TARGET', notes: 'target cursor flags, 35 words', category: '⚗️', stringIndex: null },
    { address: 0x045C3B, name: 'ALCHEMY_LEARNED_ADDR', notes: 'persistence byte $2258..$225C, 35 words', category: '⚗️', stringIndex: null },
    { address: 0x045C81, name: 'ALCHEMY_LEARNED_MASK', notes: 'bit in that byte', category: '⚗️', stringIndex: null },
    { address: 0x045DDF, name: 'ALCHEMY_ANIM_MAP', notes: 'animation id per formula', category: '⚗️', stringIndex: null },
    { address: 0x045E6B, name: 'ALCHEMY_POWER', notes: 'base power: 0 utility, 15 Defend, up to 112 Nitro', category: '⚗️', stringIndex: null },
    { address: 0x045F17, name: 'CALL_BEAD_POWER', notes: '16 Call Bead spells', category: '⚗️', stringIndex: null },
    { address: 0x04601F, name: 'ALCHEMY_COST_DATA', notes: '35 × [ing1, ing2, qty1, qty2]', category: '⚗️', stringIndex: null },
    { address: 0xC45802, name: 'Alchemy script pointer table', notes: '4 bytes/entry [addr:16][bank:8][0]; length not measured', category: '⚗️', stringIndex: null },

    // Core ROM pointer tables
    { address: 0x9FFDE7, name: 'Room pointer table', notes: '128 × [ptr:24, pad:8], room id × 4', category: '📋', stringIndex: null },
    { address: 0x11D000, name: 'String key table', notes: '3002 × 3 bytes: (bank<<15)|(addr&$7FFF)', category: '📋', stringIndex: null },
    { address: 0x12801B, name: 'Room enter-script table', notes: '5 bytes per room, packed pointer first; read by $8C:CE99', category: '📋', stringIndex: null },
    { address: 0x0EB678, name: 'Character table', notes: '141 × 74-byte records: name, AI, flags, palette, radius, stats, animations', category: '👾', stringIndex: null },
    { address: 0x043C92, name: 'Global animation ids', notes: '212 words → record offsets in $C4', category: '📋', stringIndex: null },
    { address: 0x043E3A, name: 'Animation records', notes: '4 bytes [script:16][bank:8][flags:8]; heads of 1, 4 or 8 facings', category: '🎞️', stringIndex: null },
    { address: 0x0438E6, name: 'Boy weapon table', notes: '15 × 36 bytes: attack, walk, run, knockback per weapon', category: '⚔️', stringIndex: null },
    { address: 0x10D9A6, name: 'Projectile records', notes: '21 × 24 bytes; id = address in $90; thrown by opcode 0x4C', category: '👾', stringIndex: null },
    { address: 0x108000, name: 'Animation VM dispatch', notes: '103 × 2-byte handlers, (cmd & $7F)·2', category: '📋', stringIndex: null },
    { address: 0x0E8000, name: 'Ring-menu icon table', notes: '162 words, one per RING_MENU_ICON id', category: '🎒', stringIndex: null },
    { address: 0x0F945F, name: 'Dog form pointers', notes: '6 words into bank $CF', category: '📋', stringIndex: null },
    { address: 0x019903, name: 'Song pointer table', notes: '71 × 24-bit pointers to descriptors in $8A..$8B', category: '📋', stringIndex: null },
    { address: 0x0199D8, name: 'Internal song index sequence', notes: '0x01..0x46', category: '📋', stringIndex: null },
    { address: 0x019A1E, name: 'Song dependency table', notes: 'SFX 0..89 → soundbank song needed in ARAM', category: '📋', stringIndex: null },
    { address: 0x0C8362, name: 'SFX translation table', notes: 'opcode 0x30 (sound): 112 words, $FFFF = muted', category: '📋', stringIndex: null },
    { address: 0x0C8442, name: 'Music translation table', notes: 'opcode 0x33 (music): 73 words → song id', category: '📋', stringIndex: null },
];

const TABLE_BY_ADDRESS = new Map();
for (const t of TABLES) {
    TABLE_BY_ADDRESS.set(t.address, t);
}

function getTable(address) {
    if (typeof address !== 'number') return null;
    return TABLE_BY_ADDRESS.get(address) || null;
}

function getTableName(address, options = {}) {
    const table = getTable(address);
    if (!table) return `Table $${address.toString(16).toUpperCase()}`;
    return resolveLocalizedName(table, options.rom, 'name');
}

module.exports = {
    TABLES,
    TABLE_BY_ADDRESS,
    getTable,
    getTableName,
};

