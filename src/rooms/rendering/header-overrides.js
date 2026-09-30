'use strict';
// Ownership: the map editor's room-header overrides (map-editor-info.js's
// `_edit.header`) applied to a decoded room before it is drawn, and the cache
// key fragment for them. Only the fields the renderer reads: main screen (TM),
// sub screen (TS) and colour math (CGADSUB) — maps/render.ts compositeLayers.

const RENDER_FIELDS = ['displayTm', 'subscreenTs', 'colorMath'];

function headerOverrides(h) {
    const out = {};
    if (!h || typeof h !== 'object') return out;
    RENDER_FIELDS.forEach((k) => {
        if (h[k] !== null && h[k] !== undefined && Number.isFinite(Number(h[k]))) out[k] = Number(h[k]) & 0xff;
    });
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
    return Object.keys(o).length ? { ...room, header: { ...room.header, ...o } } : room;
}

module.exports = { headerSpec, withHeader };
