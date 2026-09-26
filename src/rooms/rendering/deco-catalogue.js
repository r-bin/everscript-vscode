'use strict';
// Ownership: the deco library — every distinct object vanilla places, as
// something the editor can stamp into *any* room.
//
// Section 3 objects are the game's deco widgets: room 0x51 is 25 gourds and
// pots, room 0x25's 4x3 objects are fire pits. So the library is already in
// the ROM and this reads it out.
//
// Two things make an entry portable, and the first version had neither:
//
//  1. **A tilemap word is room-relative.** Its low ten bits index that
//     room's Block 1, its palette bits index that room's seven families.
//     Copied verbatim into another room the same word names a different
//     picture in different colours — which is why a stamped gourd came out
//     as rubble. An entry therefore stores `{graphic, family, flags}` and
//     the destination rebuilds the word.
//  2. **An object's rectangle contains the floor it is standing on.**
//     83.4% of the terrain words inside vanilla's object rectangles are also
//     used outside them: they are the room's ground, not the object. Those
//     are dropped, so a stamp carries the thing and not the place.
//
// **There are no names in the ROM.** An object is a rectangle of metatiles
// with an id, and nothing says "gourd". Entries carry their picture, size,
// origin and state count — enough to find one by looking. Nothing here
// invents a label.
//
// See docs/map-format/building-a-room-from-a-picture.md §9.

const maps = require('../../maps');
const { romFingerprint } = require('./rom-fingerprint');
const { VANILLA_ROOMS } = require('../data/vanilla-data');

/** Below this an "object" is a doorway marker or a single tile, not deco. */
const MIN_SIZE = 2;
/** Above this it is scenery built into the room, not something to stamp. */
const MAX_SIZE = 6;
/** The loader clamps CGRAM to seven families; an entry past that is unusable. */
const MAX_FAMILIES = 7;

let CATALOGUE = null;
let CATALOGUE_KEY = '';

function roomLabels() {
    const out = new Map();
    for (const { area, rooms } of VANILLA_ROOMS) {
        for (const r of rooms) out.set(parseInt(r.id, 16), { area, name: r.name });
    }
    return out;
}

/** chr -> Block 1 slot, the same mapping `renderVramLayer` resolves with. */
function charIndexToSlot(chr) {
    return Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2);
}

const ART = new Map();

/**
 * Does this graphic draw anything at all?
 *
 * Colour index 0 is transparent, so a graphic of nothing but zeroes is the
 * format's "nothing here". 122 of the 127 rooms use one as their canopy
 * filler; the other five (0x0e, 0x1e, 0x4d, 0x72, 0x73) have real ceiling
 * art as their most-placed canopy word, which is why blankness is tested on
 * the pixels rather than on "the word this room uses most".
 */
function hasArt(rom, graphic) {
    let known = ART.get(graphic);
    if (known === undefined) {
        try {
            known = maps.decodeTilePixels(maps.decompressTile16x16(rom, graphic)).some((p) => p !== 0);
        } catch {
            known = true; // a graphic that will not decode is not evidence of emptiness
        }
        ART.set(graphic, known);
    }
    return known;
}

/**
 * Split a tilemap word into the parts that survive a change of room.
 *
 * `undefined` where the word names something this room cannot explain — a
 * slot past Block 1, or palette 0, which is the HUD's and never a family.
 */
function portable(room, tileIds, word) {
    const graphic = tileIds[charIndexToSlot(word & 0x3ff)];
    const pal = (word >> 10) & 0x07;
    if (graphic === undefined || pal < 1) return undefined;
    const family = room.tileFamilies[pal - 1];
    if (family === undefined) return undefined;
    // Priority and the two flips are geometry, not identity: they mean the
    // same thing in any room, so they ride along untouched.
    return { graphic, family, flags: word & 0xe000 };
}

/** The object rectangles of a room, and which grid cells they cover. */
function objectRects(room) {
    const covered = room.layer1MetatileIds.map((r) => r.map(() => false));
    const rects = [];
    for (const object of room.objects) {
        const state = object.states[0];
        if (!state) continue;
        const w = state.targetWidth;
        const h = state.targetHeight;
        if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) continue;
        rects.push({ object, state });
        for (let y = 0; y < h; y += 1) {
            const row = covered[state.tileY + y];
            if (!row) continue;
            for (let x = 0; x < w; x += 1) row[state.tileX + x] = true;
        }
    }
    return { rects, covered };
}

/**
 * What the room looks like where no object is standing.
 *
 * `terrain` is every ground word used outside an object rectangle — the
 * room's floor vocabulary — and `collision` is what the room normally does
 * on each of those, so an object cell that only repeats the floor's own
 * collision can be recognised as bounding-box filler and dropped.
 */
function roomBackground(room, covered) {
    const terrain = new Set();
    const tally = new Map();
    const grid = room.layer1MetatileIds;
    const { layer2, collision } = room.metatileSlices;
    for (let y = 0; y < grid.length; y += 1) {
        for (let x = 0; x < grid[y].length; x += 1) {
            if (covered[y][x]) continue;
            const i = maps.metatileIndex(room, grid[y][x]);
            if (i < 0 || i >= room.metatileCount) continue;
            const word = layer2[i] || 0;
            terrain.add(word);
            const key = `${word}:${collision[i] || 0}`;
            tally.set(key, (tally.get(key) || 0) + 1);
        }
    }
    const floor = new Map();
    for (const [key, n] of tally) {
        const [word, coll] = key.split(':').map(Number);
        const best = floor.get(word);
        if (!best || best[1] < n) floor.set(word, [coll, n]);
    }
    return { terrain, floor };
}

/**
 * One object's cells, background stripped, in portable form.
 *
 * `null` for either layer means "whatever is already there" — that is the
 * whole of being agnostic of the background. A cell that ends up all-null
 * *and* carries the floor's own collision is pure bounding box and is left
 * out, so a 2x3 entry whose art is two cells really does stamp two cells.
 */
function objectCells(rom, room, state, background) {
    const grid = room.layer1MetatileIds;
    const tileIds = room.tilePalette.concat(room.animatedTiles);
    const { layer1, layer2, collision } = room.metatileSlices;
    const cells = [];
    const families = new Set();
    const graphics = new Set();

    for (let y = 0; y < state.targetHeight; y += 1) {
        const row = grid[state.tileY + y];
        if (!row) return null;
        for (let x = 0; x < state.targetWidth; x += 1) {
            const i = maps.metatileIndex(room, row[state.tileX + x]);
            if (i < 0 || i >= room.metatileCount) return null;
            const l1 = layer1[i] || 0;
            const l2 = layer2[i] || 0;
            const coll = collision[i] || 0;

            let canopy = portable(room, tileIds, l1);
            if (canopy === undefined) return null;
            if (canopy && !hasArt(rom, canopy.graphic)) canopy = null;

            let terrain = background.terrain.has(l2) ? null : portable(room, tileIds, l2);
            if (terrain === undefined) return null;
            if (terrain && !hasArt(rom, terrain.graphic)) terrain = null;

            const floor = background.floor.get(l2);
            if (!canopy && !terrain && floor && floor[0] === coll) continue;

            if (canopy) { families.add(canopy.family); graphics.add(canopy.graphic); }
            if (terrain) { families.add(terrain.family); graphics.add(terrain.graphic); }
            cells.push({ dx: x, dy: y, canopy: canopy || null, terrain: terrain || null, collision: coll });
        }
    }
    if (!cells.length) return null;
    return { cells, families: [...families], graphics: [...graphics] };
}

/**
 * What an object's area turns into at its first change, in portable form —
 * the look the editor's Object tab draws over the map (map-editor-objects.js).
 *
 * A state descriptor is an XOR of the area's metatile ids (maps/objects.ts),
 * so the changed id is the grid's id XOR the delta; its words are resolved
 * through the room's dictionary like any cell. A cell the change leaves
 * alone is left out. Relative to the entry's own rectangle. Empty when the
 * change cannot be read or names something no other room could draw.
 */
function objectStateCells(rom, room, object, rect) {
    const st = object.states[0];
    if (!st) return [];
    let stamp;
    try { stamp = maps.parseObjectStamp(rom, room.objectArea, st.metatileId); } catch { return []; }
    if (!stamp || !stamp.valid) return [];
    const tileIds = room.tilePalette.concat(room.animatedTiles);
    const { layer1, layer2, collision } = room.metatileSlices;
    const out = [];
    for (let k = 0; k < stamp.deltas.length; k++) {
        const delta = stamp.deltas[k];
        if (delta === null || delta === 0) continue;
        const tx = st.tileX + (k % stamp.tw);
        const ty = st.tileY + Math.floor(k / stamp.tw);
        const row = room.layer1MetatileIds[ty];
        if (!row || row[tx] === undefined) continue;
        const i = maps.metatileIndex(room, row[tx] ^ delta);
        if (i < 0 || i >= room.metatileCount) continue;
        const canopy = portable(room, tileIds, layer1[i] || 0);
        const terrain = portable(room, tileIds, layer2[i] || 0);
        if (canopy === undefined || terrain === undefined) return [];
        out.push({ dx: tx - rect.tileX, dy: ty - rect.tileY, canopy, terrain, collision: collision[i] || 0 });
    }
    return out;
}

/**
 * The B-trigger that makes an object do something, if it has one.
 *
 * 99 of the 863 candidate objects sit under one, and 50 of those use the
 * same shape: the object's rectangle grown one tile right and down. The
 * script id is vanilla's — a stamped gourd runs the gourd script it was
 * copied from, which is what makes it work on placement and also what the
 * editor has to say out loud, because two gourds sharing a script share its
 * flag as well.
 */
function triggerFor(room, state) {
    const x2 = state.tileX + state.targetWidth - 1;
    const y2 = state.tileY + state.targetHeight - 1;
    for (const t of room.triggers.bTrigger) {
        if (t.x1 > x2 || t.x2 < state.tileX || t.y1 > y2 || t.y2 < state.tileY) continue;
        return {
            dx: t.x1 - state.tileX, dy: t.y1 - state.tileY,
            w: t.x2 - t.x1 + 1, h: t.y2 - t.y1 + 1,
            scriptId: t.scriptId,
        };
    }
    return null;
}

/**
 * Every distinct object vanilla places, deduplicated by what it is made of.
 *
 * The signature is the portable cells, so two objects that differ only in
 * the floor they stand on are now the same entry — which is the point.
 */
function buildDecoCatalogue(rom) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const key = romFingerprint(buf);
    if (CATALOGUE && CATALOGUE_KEY === key) return CATALOGUE;

    const labels = roomLabels();
    const bySignature = new Map();

    for (let id = 0; id < maps.MAX_ROOMS; id += 1) {
        let room;
        try { room = maps.decodeRoom(buf, id); } catch { continue; }
        const { rects, covered } = objectRects(room);
        if (!rects.length) continue;
        const background = roomBackground(room, covered);
        const label = labels.get(id);

        for (const { object, state } of rects) {
            const built = objectCells(buf, room, state, background);
            if (!built || built.families.length > MAX_FAMILIES) continue;

            const signature = `${state.targetWidth}x${state.targetHeight}:` + built.cells.map((c) => [
                c.dx, c.dy,
                c.canopy ? `${c.canopy.graphic}/${c.canopy.family}/${c.canopy.flags}` : '-',
                c.terrain ? `${c.terrain.graphic}/${c.terrain.family}/${c.terrain.flags}` : '-',
                c.collision,
            ].join(',')).join('|');
            const hit = bySignature.get(signature);
            if (hit) { hit.count += 1; continue; }

            bySignature.set(signature, {
                id: bySignature.size,
                room: id,
                area: label ? label.area : 'unknown',
                roomName: label ? label.name : `room 0x${id.toString(16)}`,
                x: state.tileX,
                y: state.tileY,
                w: state.targetWidth,
                h: state.targetHeight,
                /** More than one state means it opens, breaks or burns. */
                states: object.states.length,
                trigger: triggerFor(room, state),
                /** Its first change, portable (objectStateCells). */
                stateCells: objectStateCells(buf, room, object, state),
                count: 1,
                families: built.families,
                graphics: built.graphics,
                cells: built.cells,
            });
        }
    }

    CATALOGUE = [...bySignature.values()].sort((a, b) => b.count - a.count || a.id - b.id);
    CATALOGUE_KEY = key;
    return CATALOGUE;
}

/** The catalogue without the cell data — small enough to send whole. */
function decoIndex(rom) {
    return buildDecoCatalogue(rom).map((d) => ({
        id: d.id, area: d.area, roomName: d.roomName, room: d.room,
        w: d.w, h: d.h, states: d.states, count: d.count,
        /**
         * The families themselves, not a count.
         *
         * Whether an entry is usable depends on the families the room
         * already has — 93 of the 532 cost room 0x34 nothing at all — and
         * only the editor knows those, so it needs the ids to compare.
         */
        families: d.families,
        /** How many Block 1 slots it wants. */
        graphics: d.graphics.length,
        /** Only the drawn cells, so "2x3, 2 cells" reads as the L it is. */
        cells: d.cells.length,
        /**
         * True when every cell draws on the canopy only.
         *
         * 352 of the 532 are like this: pure foreground over whatever floor
         * they land on, which is what a gourd should be.
         */
        front: d.cells.every((c) => !c.terrain),
        /**
         * True when every cell draws on the terrain only, drawing nothing on
         * the canopy — the same test as `front`, mirrored. 33 of the 532 are
         * like this: floor decoration (a rug, a patch of rubble) with
         * nothing standing above it. Used by the Widgets tab
         * (map-editor-deco.js) to group entries into Foreground/Background/
         * Misc, since the ROM has no category of its own to read out.
         */
        back: d.cells.length > 0 && d.cells.every((c) => !!c.terrain && !c.canopy),
        scriptId: d.trigger ? d.trigger.scriptId : null,
    }));
}

/** One entry, with everything needed to place it. */
function decoCells(rom, id) {
    const hit = buildDecoCatalogue(rom).find((d) => d.id === Number(id));
    if (!hit) return null;
    return {
        id: hit.id, w: hit.w, h: hit.h, states: hit.states,
        roomName: hit.roomName, room: hit.room,
        families: hit.families, graphics: hit.graphics,
        trigger: hit.trigger, cells: hit.cells, stateCells: hit.stateCells || [],
    };
}

function invalidateDecoCatalogue() { CATALOGUE = null; CATALOGUE_KEY = ''; ART.clear(); }

module.exports = { buildDecoCatalogue, decoIndex, decoCells, invalidateDecoCatalogue };
