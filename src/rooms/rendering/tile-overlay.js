'use strict';
// Ownership: turn a decoded room's collision grid into SVG path data for the
// Rooms tab map view.
//
// Pure. Consumes the maps domain (src/maps), emits geometry only — no DOM, no
// VS Code API. Lives in rooms/ because the Rooms tab owns its own rendering;
// src/maps stays a pure model.
//
// One <path> per visual class rather than one <rect> per tile: a 128x70 room is
// 8960 tiles, and that many DOM nodes makes the panel crawl.

const maps = require('../../maps');

// SVG coords are 8px-tile units; a map metatile is 16px, so it spans 2 units.
const UNITS_PER_METATILE = 2;

/**
 * Visual classes, in paint order. `open` is deliberately not painted — leaving
 * it transparent lets the existing grid and room image show through.
 */
const CLASSES = [
    { key: 'solid', fill: 'rgba(196,72,60,0.34)' },
    { key: 'partial', fill: 'rgba(206,146,62,0.30)' },
    { key: 'water', fill: 'rgba(72,126,196,0.28)' },
];

/** Classify one collision word into a visual bucket, or null to leave unpainted. */
function classifyTile(cw) {
    const geometry = maps.passability(cw, maps.tilePlane(cw));
    if (geometry === maps.SOLID) return 'solid';
    if (geometry !== maps.OPEN) return 'partial';
    if (maps.driftVector(cw).name) return 'water'; // drift tiles read as current/flow
    return null;
}

/**
 * Build SVG path data for a room's collision grid.
 *
 * @param {number[][]} collisionWords `[y][x]` collision words from decodeRoom.
 * @param {number} originX Left edge of the SVG viewBox, in 8px-tile units.
 * @param {number} originY Top edge of the SVG viewBox, in 8px-tile units.
 * @returns {{layers: Array<{key:string, fill:string, d:string}>, painted:number}}
 */
function buildCollisionPaths(collisionWords, originX, originY) {
    const buckets = new Map(CLASSES.map((c) => [c.key, []]));
    let painted = 0;

    // Merge horizontal runs of the same class into one subpath. Solid regions
    // are highly contiguous, so this cuts the emitted path data by ~5x.
    for (let y = 0; y < collisionWords.length; y++) {
        const row = collisionWords[y];
        const sy = originY + y * UNITS_PER_METATILE;
        let runKey = null;
        let runStart = 0;

        const flush = (endX) => {
            if (!runKey) return;
            const sx = originX + runStart * UNITS_PER_METATILE;
            const w = (endX - runStart) * UNITS_PER_METATILE;
            buckets.get(runKey).push('M' + sx + ' ' + sy + 'h' + w + 'v2h-' + w + 'z');
        };

        for (let x = 0; x < row.length; x++) {
            const key = classifyTile(row[x]);
            if (key) painted += 1;
            if (key !== runKey) {
                flush(x);
                runKey = key;
                runStart = x;
            }
        }
        flush(row.length);
    }

    const layers = CLASSES
        .map((c) => ({ key: c.key, fill: c.fill, d: buckets.get(c.key).join('') }))
        .filter((layer) => layer.d.length > 0);

    return { layers, painted };
}

/**
 * Decode a room and produce everything the Rooms tab webview needs to paint it.
 *
 * @param {Uint8Array|Buffer} rom  ROM buffer.
 * @param {number} roomId          Vanilla room id (0x00..0x7E).
 * @param {number} originX         SVG viewBox left edge, 8px-tile units.
 * @param {number} originY         SVG viewBox top edge, 8px-tile units.
 */
function buildRoomTileOverlay(rom, roomId, originX, originY) {
    const room = maps.decodeRoom(rom instanceof Uint8Array ? rom : new Uint8Array(rom), roomId);
    const { layers, painted } = buildCollisionPaths(room.collisionWords, originX || 0, originY || 0);

    return {
        roomId,
        widthTiles: room.header.widthTiles,
        heightTiles: room.header.heightTiles,
        layers,
        paintedTiles: painted,
        elevationPlanes: room.elevationPlanes,
        cuttableGrassTiles: room.cuttableGrass.tiles.length,
        objectCount: room.objects.length,
        stepOnCount: room.triggers.stepOn.length,
        bTriggerCount: room.triggers.bTrigger.length,
    };
}

module.exports = { buildRoomTileOverlay, buildCollisionPaths, classifyTile, CLASSES };
