'use strict';
// Ownership: the map editor's room-header overrides (map-editor-info.js's
// `_edit.header`) applied to a decoded room before it is drawn, and the cache
// key fragment for them. Only the fields the renderer reads: main screen (TM),
// sub screen (TS) and colour math (CGADSUB) — maps/render.ts compositeLayers.
//
// Plus one that is not a header byte: `mapPalette`, the family set the Header
// sub-tab is previewing (map-editor-family-sets.js). It is the script variable
// MAP_PALETTE (`$7E2437`), 0 when a room loads.

const RENDER_FIELDS = ['displayTm', 'subscreenTs', 'colorMath'];

function headerOverrides(h) {
    const out = {};
    if (!h || typeof h !== 'object') return out;
    RENDER_FIELDS.concat('mapPalette').forEach((k) => {
        if (h[k] !== null && h[k] !== undefined && Number.isFinite(Number(h[k]))) out[k] = Number(h[k]) & 0xff;
    });
    if (!out.mapPalette) delete out.mapPalette;
    return out;
}

/**
 * The families a room shows with MAP_PALETTE = `start`, as `$90D020` loads
 * them: up to seven entries from `start` into slots 1.., and nothing else
 * touched — so a short set (8 entries, start 4) leaves slots 5..7 in the
 * colours the room loaded with. `$90CBB3` reloads this way when a script
 * changes the variable.
 */
function familiesAt(families, start) {
    const out = families.slice(0, 7);
    const count = Math.min(7, families.length - start);
    for (let i = 0; i < count; i++) out[i] = families[start + i];
    return out;
}

/** `''` for no override, else a stable key fragment. */
function headerSpec(h) {
    const o = headerOverrides(h);
    return Object.keys(o).map((k) => k + '=' + o[k]).join(',');
}

/** The room with the overrides in its header; the room itself when there are none. */
function withHeader(room, h) {
    const o = headerOverrides(h);
    if (!Object.keys(o).length) return room;
    const { mapPalette, ...fields } = o;
    const out = { ...room, header: { ...room.header, ...fields } };
    if (mapPalette && mapPalette < room.tileFamilies.length) out.tileFamilies = familiesAt(room.tileFamilies, mapPalette);
    return out;
}

module.exports = { headerSpec, withHeader, familiesAt };
