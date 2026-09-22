'use strict';
// Ownership: the vanilla index and the room budget, packaged for the Rooms
// tab. Cached per ROM, because building it decodes all 127 rooms.
//
// Only the room's *own* graphics are annotated. The full index is 5628
// graphics and 11028 pairings; the tab needs the 92 the room loaded, so
// sending the rest would be 60x the payload for nothing.
//
// See docs/map-format/building-a-room-from-a-picture.md §2.

const maps = require('../../maps');
const { romFingerprint } = require('./rom-fingerprint');

let cached = null;
let cachedKey = '';

/** The index for this ROM, built once. ~64 ms on a cold call. */
function vanillaIndex(rom) {
    const key = romFingerprint(rom);
    if (cached && cachedKey === key) return cached;
    cached = maps.buildVanillaIndex(rom);
    cachedKey = key;
    return cached;
}

/** Round a 0..1 share to whole percent; the UI never shows more precision. */
function pct(x) {
    return Math.round(x * 100);
}

/**
 * What vanilla says about each graphic this room loaded.
 *
 * `[familyId, familyPct, familyCount, collisionWord, collisionPct]` per slot,
 * with `null` where the index has never seen the graphic drawn. Packed as
 * arrays for the same reason the metatile entries are — 92 rows of objects
 * is a lot of repeated key names for five numbers.
 */
function annotateGraphics(rom, room) {
    const index = vanillaIndex(rom);
    const ids = room.tilePalette.concat(room.animatedTiles);
    return ids.map((graphic) => {
        const fam = maps.suggestFamily(index, graphic);
        const coll = maps.suggestCollision(index, graphic);
        if (!fam && !coll) return null;
        const seen = index.layers.get(graphic) || { canopy: 0, terrain: 0 };
        return [
            fam ? fam.value : null,
            fam ? pct(fam.confidence) : 0,
            fam ? fam.alternatives.length : 0,
            coll ? coll.value : null,
            coll ? pct(coll.confidence) : 0,
            seen.canopy,
            seen.terrain,
        ];
    });
}

/**
 * The room's spend against the four ceilings, plus what its families attest.
 *
 * `attested` is the number of graphics the index has seen drawn in one of
 * this room's families — the size of the vocabulary a family-filtered tile
 * list would offer, which is the number that tells you whether the family
 * choice or the slot budget is the real constraint.
 */
function budgetSummary(rom, room) {
    const index = vanillaIndex(rom);
    const budget = maps.roomBudget(room);
    return {
        graphics: budget.graphics,
        families: budget.families,
        stamps: budget.stamps,
        wram: budget.wram,
        attested: maps.graphicsForFamilies(index, room.tileFamilies).length,
    };
}

/** How many related graphics are worth sending; past this nobody scrolls. */
const RELATED_LIMIT = 600;

/**
 * What vanilla draws beside the graphics already in play.
 *
 * One message serves both uses. `scores` is the union over the whole placed
 * set — the **best** single relationship each candidate has with anything
 * already down, because a tile that belongs with one thing in the room
 * belongs in the room, and averaging would punish it for being unrelated to
 * the floor. The editor turns it into a lookup and sorts any family's art
 * with it locally, so changing the selection costs one small round trip
 * rather than re-fetching every sheet.
 *
 * Rows are `[graphic, score0to100, adjacencies]`, strongest first.
 *
 * See docs/map-format/map-editor-window.md §2.
 */
function relatedTiles(rom, graphics) {
    const index = vanillaIndex(rom);
    const seed = (graphics || []).map(Number).filter((n) => !isNaN(n));
    const best = new Map();
    for (const g of seed) {
        for (const r of maps.relatedGraphics(index, g, RELATED_LIMIT)) {
            const had = best.get(r.graphic);
            if (!had || had[0] < r.score) best.set(r.graphic, [r.score, r.uses]);
        }
    }
    // A seed graphic is not its own recommendation — it is already placed.
    for (const g of seed) best.delete(g);
    return [...best]
        .map(([graphic, [score, uses]]) => [graphic, pct(score), uses])
        .sort((a, b) => b[1] - a[1] || b[2] - a[2] || a[0] - b[0])
        .slice(0, RELATED_LIMIT);
}

/** Drop the cached index (call when the ROM changes). */
function invalidateVanillaIndex() {
    cached = null;
    cachedKey = '';
}

module.exports = {
    vanillaIndex, annotateGraphics, budgetSummary, relatedTiles, invalidateVanillaIndex,
};
