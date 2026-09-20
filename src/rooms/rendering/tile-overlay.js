'use strict';
// Ownership: produce everything the Rooms tab needs to draw a ROM room — the
// rendered map image for a chosen layer, plus overlay geometry for collision,
// objects, drift and cuttable grass.
//
// Pure apart from the module-level render cache. Consumes the maps domain
// (src/maps); emits a PNG data URI and SVG geometry. Lives in rooms/ because
// the Rooms tab owns its rendering; src/maps stays a pure model.

const maps = require('../../maps');

// SVG coords are 8px-tile units; a map metatile is 16px, so it spans 2 units.
const U = 2;

/** Which render the map image shows. */
const LAYERS = ['composite', 'layer1', 'layer2'];

// One colour per elevation plane (collision word bits 5..4), matching
// render_map.py. Plane 1 keeps the familiar red because 104 of the 127 vanilla
// rooms are plane-1 only, so single-level rooms look the way they always have.
const PLANE_COLORS = {
    0: 'rgba(0,170,255,',
    1: 'rgba(235,25,25,',
    2: 'rgba(0,255,170,',
    3: 'rgba(190,90,255,',
};
const FILL_ALPHA = '0.34)';
const CONTOUR_ALPHA = '0.95)';

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
 * Collision geometry in two styles, each grouped into one path per plane
 * colour. Grouping matters: a 128x70 room is 8960 tiles, and one SVG node per
 * tile makes pan/zoom crawl.
 *
 * - `fill`: every blocked tile shaded. Reads clearly on a single-plane room.
 * - `contour`: only the edges where a plane's solid region meets open space,
 *   which is what `render_map.py` draws. On a multi-plane room overlapping
 *   levels read as crossing outlines instead of stacked translucent blobs.
 *
 * Upstream does its edge detection per pixel using the geometry masks; this
 * works per metatile, so a slope's diagonal contributes its own polygon edge
 * rather than a pixel-accurate staircase.
 */
function buildCollisionPaths(collisionWords, originX, originY) {
    const fillBuckets = new Map();
    const edgeBuckets = new Map();
    let painted = 0;

    const height = collisionWords.length;
    const width = height ? collisionWords[0].length : 0;

    // Solid-ness per plane, so a contour can be traced per elevation level.
    const solidAt = (x, y, plane) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return false;
        return maps.passability(collisionWords[y][x], plane) === maps.SOLID;
    };

    const push = (map, key, d) => {
        const cur = map.get(key);
        if (cur) cur.push(d);
        else map.set(key, [d]);
    };

    for (let y = 0; y < height; y++) {
        const row = collisionWords[y];
        const oy = originY + y * U;
        for (let x = 0; x < row.length; x++) {
            const cw = row[x];
            const plane = maps.tilePlane(cw);
            const geometry = maps.passability(cw, plane);
            const shape = GEOMETRY_SHAPES[geometry];
            if (!shape) continue;

            const color = PLANE_COLORS[plane] || PLANE_COLORS[1];
            const ox = originX + x * U;
            push(fillBuckets, color + FILL_ALPHA, polygonPath(shape, ox, oy));
            painted += 1;

            // Contour: emit only the sides facing open space. A partially
            // solid tile (slope, half block) always gets its own outline,
            // since its boundary is interior to the tile.
            if (geometry !== maps.SOLID) {
                push(edgeBuckets, color + CONTOUR_ALPHA, polygonPath(shape, ox, oy));
                continue;
            }
            if (!solidAt(x, y - 1, plane)) push(edgeBuckets, color + CONTOUR_ALPHA, 'M' + ox + ' ' + oy + 'h' + U);
            if (!solidAt(x, y + 1, plane)) push(edgeBuckets, color + CONTOUR_ALPHA, 'M' + ox + ' ' + (oy + U) + 'h' + U);
            if (!solidAt(x - 1, y, plane)) push(edgeBuckets, color + CONTOUR_ALPHA, 'M' + ox + ' ' + oy + 'v' + U);
            if (!solidAt(x + 1, y, plane)) push(edgeBuckets, color + CONTOUR_ALPHA, 'M' + (ox + U) + ' ' + oy + 'v' + U);
        }
    }

    const layers = [];
    fillBuckets.forEach((paths, fill) => layers.push({ fill, d: paths.join('') }));
    const contour = [];
    edgeBuckets.forEach((paths, stroke) => contour.push({ stroke, d: paths.join('') }));
    return { layers, contour, painted };
}

/** Drift tiles: where the floor pushes an entity, and which way. */
function buildDrift(collisionWords) {
    const out = [];
    for (let y = 0; y < collisionWords.length; y++) {
        const row = collisionWords[y];
        for (let x = 0; x < row.length; x++) {
            const d = maps.driftVector(row[x]);
            if (d.name) out.push({ x, y, dx: d.dx, dy: d.dy, name: d.name });
        }
    }
    return out;
}

/**
 * Section 3 map objects, flattened to their drawable states.
 * Coordinates are metatile units; the webview scales them by U.
 */
function buildObjects(room) {
    return room.objects.map((obj) => ({
        index: obj.objectIndex,
        maxState: obj.maxState,
        states: obj.states.map((s) => ({
            state: s.state,
            x: s.tileX,
            y: s.tileY,
            w: s.targetWidth,
            h: s.targetHeight,
            metatileId: s.metatileId,
            tiles: s.metatiles.length,
        })),
    }));
}

// Rendering a large room costs ~150ms (mostly PNG deflate) per layer, so keep
// recent results around — switching layers or rooms should feel instant.
//
// The key includes a ROM fingerprint: keying on roomId+layer alone meant a
// rebuilt ROM (everscript.buildAndRun) kept serving the pre-rebuild render
// forever, which is worse than slow — it silently shows the wrong map.
const RENDER_CACHE = new Map();
const RENDER_CACHE_MAX = 24;

/**
 * Cheap ROM identity: length plus a few interior bytes. A recompile changes
 * map data, so sampling across the file catches it without hashing 3MB on
 * every room selection.
 */
function romFingerprint(rom) {
    let h = rom.length;
    const step = Math.max(1, Math.floor(rom.length / 64));
    for (let i = 0; i < rom.length; i += step) h = ((h * 31) + rom[i]) | 0;
    return h;
}

function cacheKey(fingerprint, roomId, layer) { return fingerprint + ':' + roomId + ':' + layer; }

function renderLayer(rom, room, layer) {
    if (layer === 'layer1') return maps.renderVramLayer(rom, room, room.layer1VramWords);
    if (layer === 'layer2') return maps.renderVramLayer(rom, room, room.layer2VramWords);
    return maps.renderRoomComposite(rom, room);
}

function cachedRender(rom, roomId, layer) {
    const key = cacheKey(romFingerprint(rom), roomId, layer);
    const hit = RENDER_CACHE.get(key);
    if (hit) return hit;

    const room = maps.decodeRoom(rom, roomId);
    const image = renderLayer(rom, room, layer);
    const entry = { room, imageUri: maps.encodePngDataUri(image), width: image.width, height: image.height };

    RENDER_CACHE.set(key, entry);
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
 * @param {string} [layer]         'composite' (default), 'layer1' or 'layer2'.
 */
function buildRoomTileOverlay(rom, roomId, originX, originY, layer) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const which = LAYERS.indexOf(layer) >= 0 ? layer : 'composite';
    const { room, imageUri, width, height } = cachedRender(buf, roomId, which);
    const ox = originX || 0;
    const oy = originY || 0;
    const collision = buildCollisionPaths(room.collisionWords, ox, oy);

    return {
        roomId,
        layer: which,
        widthTiles: room.header.widthTiles,
        heightTiles: room.header.heightTiles,
        originX: ox,
        originY: oy,
        imageUri,
        imageWidth: width,
        imageHeight: height,
        collision: collision.layers,
        collisionContour: collision.contour,
        collisionTiles: collision.painted,
        drift: buildDrift(room.collisionWords),
        objects: buildObjects(room),
        grass: room.cuttableGrass.tiles.map((t) => ({ x: t[0], y: t[1] })),
        grassWarnings: room.cuttableGrass.warnings,
        elevationPlanes: room.elevationPlanes,
        tileFamilies: room.tileFamilies,
        metatileCount: room.metatileCount,
        stepOnCount: room.triggers.stepOn.length,
        bTriggerCount: room.triggers.bTrigger.length,
    };
}

module.exports = {
    buildRoomTileOverlay,
    buildCollisionPaths,
    buildDrift,
    buildObjects,
    invalidateRoomRenders,
    LAYERS,
    GEOMETRY_SHAPES,
    PLANE_COLORS,
};
