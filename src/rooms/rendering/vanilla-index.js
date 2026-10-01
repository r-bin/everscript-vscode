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

/** Candidates per side; the plus-shape cycles through these. */
const NEIGHBOUR_LIMIT = 8;
/** Families sent per candidate — enough to find one already adopted. */
const NEIGHBOUR_FAMILIES = 4;

/**
 * What vanilla draws on each side of one graphic — the armed brush.
 *
 * Its own request and its own seed, deliberately: `relatedTiles` is seeded
 * from what is *placed* and must not include the brush (§8a.1 — a seed
 * scores itself 0 and sank to the bottom of its own family's grid on every
 * click). The plus-shape is about the brush and nothing else.
 *
 * Both layers come back, because which one applies is the brush's layer,
 * and the card's centre toggles it without a round trip.
 *
 * Rows are `[graphic, score0to100, uses, families, canopyUses, terrainUses]`:
 * `families` are where vanilla draws the candidate, most-placed first, so
 * the editor can crop it from a sheet it has and tell whether using it
 * needs a palette slot; the two layer counts are what `editLayerPreference`
 * reads when it is armed.
 *
 * See docs/map-editor-redesign-plan.md §8b.
 */
function neighbourTiles(rom, graphic) {
    const index = vanillaIndex(rom);
    const g = Number(graphic);
    const out = { graphic: g, canopy: null, terrain: null };
    if (isNaN(g)) return out;
    const row = (r) => {
        const fam = maps.suggestFamily(index, r.graphic);
        const seen = index.layers.get(r.graphic) || { canopy: 0, terrain: 0 };
        return [r.graphic, pct(r.score), r.uses,
            fam ? fam.alternatives.slice(0, NEIGHBOUR_FAMILIES).map((a) => a.value) : [],
            seen.canopy, seen.terrain];
    };
    for (const [name, layer] of [['canopy', 0], ['terrain', 1]]) {
        const sides = maps.directionalNeighbours(index.directional, g, layer, NEIGHBOUR_LIMIT);
        out[name] = { n: sides.n.map(row), e: sides.e.map(row), s: sides.s.map(row), w: sides.w.map(row) };
    }
    return out;
}

const { VANILLA_ROOMS } = require('../data/vanilla-data');

let roomMetaMap = null;
function getRoomMeta(roomId) {
    if (!roomMetaMap) {
        roomMetaMap = new Map();
        for (const { area, rooms } of VANILLA_ROOMS) {
            for (const r of rooms) {
                roomMetaMap.set(parseInt(r.id, 16), { name: r.name, area, hexId: r.id });
            }
        }
    }
    return roomMetaMap.get(roomId) || { name: 'Room ' + roomId, area: 'Vanilla', hexId: '0x' + roomId.toString(16) };
}

function charIndexToSlot(charIdx) {
    return Math.floor(charIdx / 0x20) * 8 + Math.floor((charIdx % 0x20) / 2);
}

/**
 * Find vanilla scenarios where `graphic` is used.
 *
 * Returns up to `limit` scenarios across vanilla rooms. Each scenario includes
 * the room ID, name, area, total placements, layer, and a 3x3 surrounding patch
 * showing the graphic in its authentic vanilla context.
 */
function vanillaExamples(rom, graphic, limit = 8) {
    const index = vanillaIndex(rom);
    const g = Number(graphic);
    if (isNaN(g)) return [];
    const roomIds = index.graphicRooms.get(g) || [];
    const results = [];

    for (const id of roomIds) {
        if (results.length >= limit) break;
        let room;
        try {
            room = maps.decodeRoom(rom, id);
        } catch {
            continue;
        }
        const tileIds = room.tilePalette.concat(room.animatedTiles);
        const { layer1, layer2 } = room.metatileSlices;
        const grid = room.layer1MetatileIds;
        if (!grid || !grid.length) continue;

        let count = 0;
        let bestLoc = null;
        const layerSeen = { canopy: false, terrain: false };

        const h = grid.length;
        const w = grid[0].length;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const mid = grid[y][x];
                const i = maps.metatileIndex(room, mid);
                if (i < 0 || i >= room.metatileCount) continue;
                const w1 = layer1[i] || 0;
                const w2 = layer2[i] || 0;
                const g1 = tileIds[charIndexToSlot(w1 & 0x3ff)];
                const g2 = tileIds[charIndexToSlot(w2 & 0x3ff)];
                const match1 = g1 === g;
                const match2 = g2 === g;
                if (match1) { count++; layerSeen.canopy = true; }
                if (match2) { count++; layerSeen.terrain = true; }
                if ((match1 || match2) && !bestLoc) {
                    bestLoc = { x, y, layer: match1 ? 'canopy' : 'terrain' };
                }
            }
        }
        if (!bestLoc) continue;

        // 3x3 patch centered on bestLoc
        const patch = [];
        for (let dy = -1; dy <= 1; dy++) {
            const row = [];
            for (let dx = -1; dx <= 1; dx++) {
                const cy = bestLoc.y + dy;
                const cx = bestLoc.x + dx;
                if (cy < 0 || cy >= h || cx < 0 || cx >= w) {
                    row.push(null);
                    continue;
                }
                const mid = grid[cy][cx];
                const i = maps.metatileIndex(room, mid);
                if (i < 0 || i >= room.metatileCount) {
                    row.push(null);
                    continue;
                }
                const w1 = layer1[i] || 0;
                const w2 = layer2[i] || 0;
                const p1 = (w1 >> 10) & 7;
                const p2 = (w2 >> 10) & 7;
                const g1 = tileIds[charIndexToSlot(w1 & 0x3ff)];
                const g2 = tileIds[charIndexToSlot(w2 & 0x3ff)];
                const fam1 = p1 >= 1 ? room.tileFamilies[p1 - 1] : null;
                const fam2 = p2 >= 1 ? room.tileFamilies[p2 - 1] : null;
                row.push({
                    c: g1 !== undefined ? [g1, fam1, (w1 & 0x4000) ? 1 : 0, (w1 & 0x8000) ? 1 : 0] : null,
                    t: g2 !== undefined ? [g2, fam2, (w2 & 0x4000) ? 1 : 0, (w2 & 0x8000) ? 1 : 0] : null,
                });
            }
            patch.push(row);
        }

        const meta = getRoomMeta(id);
        results.push({
            roomId: id,
            hexId: meta.hexId,
            roomName: meta.name,
            area: meta.area,
            count,
            layer: layerSeen.canopy && layerSeen.terrain ? 'both' : (layerSeen.canopy ? 'canopy' : 'terrain'),
            x: bestLoc.x,
            y: bestLoc.y,
            patch,
        });
    }

    return results;
}

/**
 * Generate a procedural patch of tiles around `graphic`.
 */
function proceduralFill(rom, graphic, layerName, width = 3, height = 3, seed) {
    const index = vanillaIndex(rom);
    const g = Number(graphic);
    if (isNaN(g)) return [];
    const layer = layerName === 'canopy' ? 0 : 1;
    let rng = Math.random;
    if (seed !== undefined && seed !== null) {
        let s = Number(seed) || 1234567;
        rng = () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }
    return maps.proceduralPatch(index, g, layer, width, height, rng);
}

/** Drop the cached index (call when the ROM changes). */
/** Placed cells per collision geometry code, over every vanilla room (the Collision tab's filter). */
function vanillaGeometry(rom) {
    return vanillaIndex(rom).geometry.slice();
}

function invalidateVanillaIndex() {
    cached = null;
    cachedKey = '';
}

module.exports = {
    vanillaGeometry,
    vanillaIndex, annotateGraphics, budgetSummary, relatedTiles, neighbourTiles,
    vanillaExamples, proceduralFill, invalidateVanillaIndex,
};

