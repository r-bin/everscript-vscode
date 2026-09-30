'use strict';
// Ownership: Section 3 map objects for the Rooms tab — each object's states,
// a thumbnail of every state, and the wire form of the user's selection.
//
// Split out of tile-overlay.js, which owns the map raster. These two meet
// only where the render stamps the selected states into the room before
// drawing it, so keeping the object browser's data here leaves that file to
// the picture.
//
// Pure apart from the module-level thumbnail cache. Consumes src/maps.

const maps = require('../../maps');
const { romFingerprint } = require('./rom-fingerprint');

/**
 * Section 3 map objects, their states, and a thumbnail of each state.
 *
 * A state is reached by XOR-ing the deltas up to it into the grid, so every
 * state can be rendered exactly — see src/maps/object-stamps.ts. An object
 * with N delta records has N+1 appearances, state 0 being the loaded room.
 */
function buildObjects(rom, room, selected) {
    return room.objects.map((obj, index) => {
        const count = maps.objectStateCount(obj);
        const current = Math.min(selected[index] || maps.DEFAULT_OBJECT_STATE, count - 1);
        const box = maps.objectBounds(rom, room, obj);
        const states = [];
        for (let s = 0; s < count; s++) {
            // Descriptor s-1 is what produces appearance s; state 0 has none.
            const src = s > 0 ? obj.states[s - 1] : obj.states[0];
            let preview = null;
            try {
                const img = maps.renderObjectState(rom, room, index, s);
                if (img) preview = maps.encodePngDataUri(img);
            } catch {
                // A record that will not parse still lists, just without art.
            }
            states.push({
                state: s,
                x: src ? src.tileX : (box ? box.x : 0),
                y: src ? src.tileY : (box ? box.y : 0),
                metatileId: src ? src.metatileId : 0,
                preview,
            });
        }
        return {
            index,
            current,
            x: box ? box.x : 0,
            y: box ? box.y : 0,
            w: box ? box.w : 1,
            h: box ? box.h : 1,
            states,
            /** Identical signatures across every delta means nothing to choose. */
            stampSigs: obj.states.map((st) =>
                maps.objectStampSignature(maps.parseObjectStamp(rom, room.objectArea, st.metatileId))),
        };
    });
}

/**
 * The room's objects in the map editor's own shape (map-editor-objects.js):
 * an area — the union of every footprint its deltas touch, not the first
 * one's — and per state 1..N the cells that differ from state 0 there, as
 * dictionary indices keyed `"dx,dy"` from the area's corner.
 *
 * Deltas are cumulative XOR (object-stamps.ts), so a frame is state s's grid
 * compared with the loaded one; a cell a later delta puts back is not in it.
 * Every value lands on a Block 3 entry (19797 of 19797 writes, measured), so
 * nothing here names a stamp the room does not have.
 */
function editorObjects(rom, room) {
    const W = room.header.widthTiles;
    const H = room.header.heightTiles;
    return room.objects.map((obj, index) => {
        const box = maps.objectBounds(rom, room, obj);
        if (!box || box.w <= 0 || box.h <= 0) return null;
        const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? room.layer1MetatileIds[y][x] : null);
        const base = [];
        for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) base.push(at(box.x + x, box.y + y));
        const now = base.slice();
        const frames = obj.states.map((st) => {
            const stamp = maps.parseObjectStamp(rom, room.objectArea, st.metatileId);
            if (stamp.valid) {
                stamp.deltas.forEach((d, k) => {
                    const x = st.tileX + (k % stamp.tw) - box.x;
                    const y = st.tileY + Math.floor(k / stamp.tw) - box.y;
                    const i = y * box.w + x;
                    if (d !== null && now[i] !== null && now[i] !== undefined) now[i] ^= d;
                });
            }
            const frame = {};
            now.forEach((id, i) => {
                if (id === null || id === base[i]) return;
                const idx = maps.metatileIndex(room, id);
                if (idx >= 0 && idx < room.metatileCount) frame[(i % box.w) + ',' + Math.floor(i / box.w)] = idx;
            });
            return frame;
        });
        return { index, x: box.x, y: box.y, w: box.w, h: box.h, frames };
    }).filter(Boolean);
}

/**
 * Parse the wire form of the object-state selection: `index:state` pairs
 * joined by commas, e.g. `20:1`. A string because it also keys the cache.
 */
function parseObjectStates(spec) {
    const out = {};
    if (typeof spec !== 'string' || !spec) return out;
    for (const part of spec.split(',')) {
        const [i, st] = part.split(':').map(Number);
        if (Number.isInteger(i) && Number.isInteger(st) && i >= 0 && st > 0) out[i] = st;
    }
    return out;
}

// Thumbnails depend only on the ROM and the room, never on which state is
// selected, so they are cached apart from the map render — otherwise every
// chip click would re-render every thumbnail in the room.
const PREVIEW_CACHE = new Map();
const PREVIEW_CACHE_MAX = 8;

function cachedObjectPreviews(rom, roomId, room, selected) {
    const key = romFingerprint(rom) + ':' + roomId;
    let objects = PREVIEW_CACHE.get(key);
    if (!objects) {
        objects = buildObjects(rom, room, {});
        PREVIEW_CACHE.set(key, objects);
        if (PREVIEW_CACHE.size > PREVIEW_CACHE_MAX) PREVIEW_CACHE.delete(PREVIEW_CACHE.keys().next().value);
    }
    return objects.map((o) => ({ ...o, current: Math.min(selected[o.index] || 0, o.states.length - 1) }));
}

module.exports = { buildObjects, editorObjects, parseObjectStates, cachedObjectPreviews };
