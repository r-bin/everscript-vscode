'use strict';
// Ownership: produce everything the Rooms tab needs to draw a ROM room —
// the rendered map image plus a collision overlay.
//
// Pure apart from the module-level render cache. Consumes the maps domain
// (src/maps); emits a PNG data URI and SVG geometry. Lives in rooms/ because
// the Rooms tab owns its rendering; src/maps stays a pure model.

const maps = require('../../maps');

// SVG coords are 8px-tile units; a map metatile is 16px, so it spans 2 units.
const U = 2;

// One colour per elevation plane (collision word bits 5..4). Plane 1 keeps the
// familiar red because 104 of the 127 vanilla rooms are plane-1 only, so
// single-level rooms look the way they always have.
const PLANE_COLORS = {
    0: 'rgba(0,170,255,',
    1: 'rgba(235,25,25,',
    2: 'rgba(0,255,170,',
    3: 'rgba(190,90,255,',
};

const FILL_ALPHA = '0.34)';
const DRIFT_FILL = 'rgba(72,126,196,0.40)';

/**
 * Sub-tile geometry as polygon corners in metatile-local units (0..2).
 * Mirrors the pixel masks in maps/collision.ts `geometryMask()` — a slope tile
 * is drawn as the triangle it actually blocks, not as a full square.
 * `null` means the code blocks nothing.
 */
const GEOMETRY_SHAPES = {
    0x00: null,
    0x0f: [[0, 0], [U, 0], [U, U], [0, U]],            // full
    0x02: [[0, 0], [U, U], [0, U]],                    // py >= px
    0x06: [[0, 0], [U, U], [0, U]],
    0x01: [[U, 0], [U, U], [0, U]],                    // px + py >= 15
    0x05: [[U, 0], [U, U], [0, U]],
    0x0a: [[0, 0], [U, 0], [0, U]],                    // px + py <= 15
    0x0e: [[0, 0], [U, 0], [0, U]],
    0x09: [[0, 0], [U, 0], [U, U]],                    // py <= px
    0x0d: [[0, 0], [U, 0], [U, U]],
    0x03: [[0, 1], [U, 1], [U, U], [0, U]],            // bottom half
    0x04: [[0, 1], [U, 1], [U, U], [0, U]],
    0x0c: [[0, 0], [U, 0], [U, 1], [0, 1]],            // top half
    0x0b: [[0, 0], [U, 0], [U, 1], [0, 1]],
    0x08: [[1, 0], [U, 0], [U, U], [1, U]],            // right half
    0x07: [[0, 0], [1, 0], [1, U], [0, U]],            // left half
};

function polygonPath(shape, ox, oy) {
    let d = 'M' + (ox + shape[0][0]) + ' ' + (oy + shape[0][1]);
    for (let i = 1; i < shape.length; i++) d += 'L' + (ox + shape[i][0]) + ' ' + (oy + shape[i][1]);
    return d + 'z';
}

/**
 * Build collision overlay geometry, grouped into one path per fill colour.
 *
 * Grouping matters: a 128x70 room is 8960 tiles, and one SVG node per tile
 * makes pan/zoom crawl.
 */
function buildCollisionPaths(collisionWords, originX, originY) {
    const buckets = new Map();
    const drift = [];
    let painted = 0;

    const push = (fill, d) => {
        const cur = buckets.get(fill);
        if (cur) cur.push(d);
        else buckets.set(fill, [d]);
    };

    for (let y = 0; y < collisionWords.length; y++) {
        const row = collisionWords[y];
        const oy = originY + y * U;
        for (let x = 0; x < row.length; x++) {
            const cw = row[x];
            const ox = originX + x * U;
            const plane = maps.tilePlane(cw);
            const geometry = maps.passability(cw, plane);
            const shape = GEOMETRY_SHAPES[geometry];

            if (shape) {
                push((PLANE_COLORS[plane] || PLANE_COLORS[1]) + FILL_ALPHA, polygonPath(shape, ox, oy));
                painted += 1;
            }

            // Drift tiles carry a direction in the low nibble instead of geometry.
            const d = maps.driftVector(cw);
            if (d.name) {
                push(DRIFT_FILL, polygonPath(GEOMETRY_SHAPES[0x0f], ox, oy));
                drift.push({ x, y, dx: d.dx, dy: d.dy, name: d.name });
            }
        }
    }

    const layers = [];
    buckets.forEach((paths, fill) => layers.push({ fill, d: paths.join('') }));
    return { layers, painted, drift };
}

// Rendering a large room costs ~100-400ms (mostly PNG deflate), so keep the
// last few around — switching between rooms should feel instant.
const RENDER_CACHE = new Map();
const RENDER_CACHE_MAX = 12;

function cachedRender(rom, roomId) {
    const hit = RENDER_CACHE.get(roomId);
    if (hit) return hit;

    const room = maps.decodeRoom(rom, roomId);
    const image = maps.renderRoomComposite(rom, room);
    const entry = { room, imageUri: maps.encodePngDataUri(image), width: image.width, height: image.height };

    RENDER_CACHE.set(roomId, entry);
    if (RENDER_CACHE.size > RENDER_CACHE_MAX) RENDER_CACHE.delete(RENDER_CACHE.keys().next().value);
    return entry;
}

/** Drop cached renders (call when the ROM changes). */
function invalidateRoomRenders() { RENDER_CACHE.clear(); }

/**
 * Decode and render a room for the Rooms tab.
 *
 * @param {Uint8Array|Buffer} rom  ROM buffer.
 * @param {number} roomId          Vanilla room id (0x00..0x7E).
 * @param {number} originX         SVG viewBox left edge, 8px-tile units.
 * @param {number} originY         SVG viewBox top edge, 8px-tile units.
 */
function buildRoomTileOverlay(rom, roomId, originX, originY) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const { room, imageUri, width, height } = cachedRender(buf, roomId);
    const { layers, painted, drift } = buildCollisionPaths(room.collisionWords, originX || 0, originY || 0);

    return {
        roomId,
        widthTiles: room.header.widthTiles,
        heightTiles: room.header.heightTiles,
        imageUri,
        imageWidth: width,
        imageHeight: height,
        layers,
        paintedTiles: painted,
        drift,
        elevationPlanes: room.elevationPlanes,
        cuttableGrassTiles: room.cuttableGrass.tiles,
        objectCount: room.objects.length,
        stepOnCount: room.triggers.stepOn.length,
        bTriggerCount: room.triggers.bTrigger.length,
    };
}

module.exports = {
    buildRoomTileOverlay,
    buildCollisionPaths,
    invalidateRoomRenders,
    GEOMETRY_SHAPES,
    PLANE_COLORS,
};
