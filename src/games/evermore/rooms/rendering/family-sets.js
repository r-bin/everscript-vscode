'use strict';
// Ownership: a room's alternate family sets, for the map editor's Header
// sub-tab (map-editor-family-sets.js) — every family entry's colours, and the
// MAP_PALETTE values the room's own scripts write.
//
// A room's family list can be longer than the seven slots: `$90D020` loads
// seven starting at MAP_PALETTE (`$7E2437`, 0 on load), and a script writing
// the variable switches set (Thraxx going from orange to white, Ebon/Ivor
// Keep, dark storerooms). docs/map-format/room-reference.md §5.

const maps = require('../../maps');
const script = require('../../script');

/** `WRITE $2437 = 0x0007` in a decoded row's summary. */
const WRITE_MAP_PALETTE = /\$2437\b.*?=\s*(0x[0-9a-f]+|\d+)/i;

const _values = new Map();

/** Every MAP_PALETTE value the room's enter and trigger scripts write, sorted. */
function scriptPaletteValues(rom, roomId, key) {
    const k = key + ':' + roomId;
    if (_values.has(k)) return _values.get(k);
    const found = new Set();
    try {
        const m = script.buildRoomScriptModel(rom, roomId);
        [m.enter].concat(m.stepOn || [], m.bTrigger || []).filter(Boolean).forEach((sc) => {
            (sc.instructions || []).forEach((row) => {
                const x = WRITE_MAP_PALETTE.exec(row.summary || '');
                if (x) found.add(Number(x[1]));
            });
        });
    } catch { /* an unreadable script just offers no values */ }
    const out = Array.from(found).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    _values.set(k, out);
    return out;
}

const hex = (c) => '#' + [c[0], c[1], c[2]].map((v) => (v & 0xff).toString(16).padStart(2, '0')).join('');

/**
 * `{colors, scriptValues}`: colours 1..15 of every family entry (0 is
 * transparent), and the values scripts set. Only a room with more than seven
 * entries has sets to switch between; the rest get `null`.
 */
function familySetInfo(rom, room, roomId, key) {
    if (!room || !room.tileFamilies || room.tileFamilies.length <= 7) return null;
    return {
        colors: room.tileFamilies.map((id) => maps.extractTileFamilyPalette(rom, id).slice(1).map(hex)),
        scriptValues: scriptPaletteValues(rom, roomId, key),
    };
}

module.exports = { familySetInfo };
