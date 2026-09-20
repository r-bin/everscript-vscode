'use strict';
// Ownership: produce everything the Rooms tab needs to draw a ROM room — the
// rendered map image for a chosen layer (optionally with the collision
// visualization baked in), plus the tabular data behind the summary panel.
//
// Pure apart from the module-level render cache. Consumes the maps domain
// (src/maps). Lives in rooms/ because the Rooms tab owns its rendering;
// src/maps stays a pure model.
//
// The collision visualization is NOT drawn here as SVG any more: it is a
// faithful port of render_map.py baked into the raster by
// maps/collision-overlay.ts, which is verified pixel-identical to upstream.

const maps = require('../../maps');

/** Which render the map image shows. */
const LAYERS = ['composite', 'layer1', 'layer2'];

/**
 * How many tiles block movement, for the summary table.
 *
 * The collision *visualization* is drawn by maps/collision-overlay.ts (a port
 * of render_map.py), baked into the rendered raster — this only counts.
 */
function countCollision(collisionWords) {
    let painted = 0;
    for (let y = 0; y < collisionWords.length; y++) {
        const row = collisionWords[y];
        for (let x = 0; x < row.length; x++) {
            const plane = maps.tilePlane(row[x]);
            if (maps.passability(row[x], plane) !== maps.OPEN) painted += 1;
        }
    }
    return { painted };
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

function cachedRender(rom, roomId, layer, overlay) {
    const key = cacheKey(romFingerprint(rom), roomId, layer + (overlay ? ':' + overlay : ''));
    const hit = RENDER_CACHE.get(key);
    if (hit) return hit;

    const room = maps.decodeRoom(rom, roomId);
    const image = renderLayer(rom, room, layer);
    // The collision visualization is a faithful port of render_map.py's
    // composition pass, so it is baked into the raster exactly as upstream
    // draws it rather than approximated with SVG shapes. Trigger boxes stay
    // off: the Rooms tab draws those itself, interactively.
    if (overlay) {
        maps.drawCollisionOverlay(image, room, {
            objects: overlay.indexOf('o') >= 0,
            grass: overlay.indexOf('g') >= 0,
            triggers: false,
        });
    }
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
 * @param {string} [overlay]       Collision overlay flags: '' / undefined for
 *                                 none, otherwise any of 'c' (collision),
 *                                 'o' (objects), 'g' (grass).
 */
function buildRoomTileOverlay(rom, roomId, originX, originY, layer, overlay) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const which = LAYERS.indexOf(layer) >= 0 ? layer : 'composite';
    const flags = typeof overlay === 'string' && overlay.indexOf('c') >= 0 ? overlay : '';
    const { room, imageUri, width, height } = cachedRender(buf, roomId, which, flags);
    const ox = originX || 0;
    const oy = originY || 0;
    const collision = countCollision(room.collisionWords);

    return {
        roomId,
        layer: which,
        overlay: flags,
        widthTiles: room.header.widthTiles,
        heightTiles: room.header.heightTiles,
        originX: ox,
        originY: oy,
        imageUri,
        imageWidth: width,
        imageHeight: height,
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
    countCollision,
    buildDrift,
    buildObjects,
    invalidateRoomRenders,
    LAYERS,
};
