'use strict';
// Ownership: produce everything the Rooms tab needs to draw a ROM room — the
// rendered map image for a chosen layer with the requested features baked in,
// plus the tabular data, legend and summary behind the panel.
//
// Pure apart from the module-level render cache. Consumes the maps domain
// (src/maps). Lives in rooms/ because the Rooms tab owns its rendering;
// src/maps stays a pure model.
//
// The feature visualization is NOT drawn here as SVG: it is a faithful port of
// render_map.py baked into the raster by maps/collision-overlay.ts, verified
// pixel-identical to upstream by tests/memory/map-parity.test.js.

const maps = require('../../maps');
const { romFingerprint } = require('./rom-fingerprint');
const { headerSpec, withHeader } = require('./header-overrides');
const { buildObjects, parseObjectStates, cachedObjectPreviews } = require('./object-previews');

/** Which render the map image shows. */
const LAYERS = ['composite', 'layer1', 'layer2'];

/**
 * Overlay flag characters, in the order the top bar shows them.
 *
 * One character per feature so the whole set fits in a cache key and a
 * postMessage field. The host is the only place that maps them to the maps
 * domain's option names — the webview just passes the string around.
 */
const OVERLAY_FLAGS = {
    c: 'contours',
    d: 'drift',
    p: 'transparent',
    e: 'elevation',
    n: 'gates',
    g: 'grass',
    o: 'objects',
    t: 'triggers',
    l: 'labels',
    // Not a feature but how `c` is drawn: tile by tile instead of outlines.
    // Never part of "everything on".
    k: 'tiles',
};

/** Every feature on — what a room shows before the user opts anything out. */
const ALL_OVERLAY_FLAGS = Object.keys(OVERLAY_FLAGS).filter((ch) => ch !== 'k').join('');

/**
 * Turn a flag string into the maps domain's per-feature options.
 *
 * `null`/`undefined` means "no preference" and yields the full view; an empty
 * string means the user switched everything off and yields a bare map. That
 * distinction matters because the host used to drop the flags entirely, which
 * looked exactly like "everything off" and made the toggles appear dead.
 */
function overlayOptions(flags) {
    const s = typeof flags === 'string' ? flags : ALL_OVERLAY_FLAGS;
    const opts = {};
    Object.keys(OVERLAY_FLAGS).forEach(function (ch) {
        opts[OVERLAY_FLAGS[ch]] = s.indexOf(ch) >= 0;
    });
    return { opts: opts, flags: s, any: s.length > 0 };
}

/**
 * How many tiles block movement, for the summary table.
 *
 * The visualization itself is drawn by maps/collision-overlay.ts — this only
 * counts.
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


/** Entity-gate tiles grouped by which entities the gate blocks. */
function buildGates(features) {
    const WHO = { 3: 'all but boy and dog', 5: 'dog', 7: 'boy and dog' };
    const counts = {};
    features.gated.forEach(function (g) { counts[g[2]] = (counts[g[2]] || 0) + 1; });
    return Object.keys(counts).map(function (k) {
        return { gate: Number(k), blocks: WHO[k] || 'unknown', count: counts[k] };
    });
}

// Rendering a large room costs ~150ms (mostly PNG deflate) per layer, so keep
// recent results around — switching layers or features should feel instant.
//
// The key includes a ROM fingerprint: keying on roomId+layer alone meant a
// rebuilt ROM (everscript.buildAndRun) kept serving the pre-rebuild render
// forever, which is worse than slow — it silently shows the wrong map.
const RENDER_CACHE = new Map();
const RENDER_CACHE_MAX = 24;

function renderLayer(rom, room, layer) {
    if (layer === 'layer1') return maps.renderVramLayer(rom, room, room.layer1VramWords);
    if (layer === 'layer2') return maps.renderVramLayer(rom, room, room.layer2VramWords);
    return maps.renderRoomComposite(rom, room);
}

/**
 * The feature overlay, redrawn on top of the canopy.
 *
 * The overlay is baked into the map raster, so the canopy — which is laid
 * over that raster to cover the characters under it — would hide the very
 * marks that say where the walls are. This is the same overlay painted a
 * second time onto the canopy's own pixels, cut back to them, and drawn
 * above everything.
 *
 * Both passes are given the same `hidden` mask, so they draw the *same*
 * lines and the cut only decides which copy of a pixel is on screen. Giving
 * it to the canopy pass alone was the bug behind "the detection seems off":
 * wherever the canopy art had a hole, the map's own thick line showed
 * through a boundary the other pass had already thinned.
 *
 * Only the pixels the second pass actually changed survive, so the layer is
 * marks on transparency rather than a second copy of the canopy.
 */
function overlayOverCanopy(foreground, room, opts, hidden) {
    const canopyPx = maps.opaqueMask(foreground);
    const before = foreground.data;
    const marks = {
        width: foreground.width,
        height: foreground.height,
        data: Uint8Array.from(before),
    };
    maps.drawCollisionOverlay(marks, room, Object.assign({}, opts, { hidden }));
    const out = marks.data;
    let painted = 0;
    for (let i = 0; i < canopyPx.length; i++) {
        const o = i * 4;
        const same = out[o] === before[o] && out[o + 1] === before[o + 1] && out[o + 2] === before[o + 2];
        if (!canopyPx[i] || same) out[o + 3] = 0;
        else painted += 1;
    }
    return painted ? marks : null;
}

function cachedRender(rom, roomId, layer, ov, stateSpec, header) {
    const key = romFingerprint(rom) + ':' + roomId + ':' + layer + ':' + ov.flags + ':' + stateSpec + ':' + headerSpec(header);
    const hit = RENDER_CACHE.get(key);
    if (hit) return hit;

    // Stamp the chosen states in before rendering, so the map shows the chest
    // open or the bridge extended. Collision follows automatically: it is
    // looked up from the same metatile ID the stamp rewrites.
    const base = maps.decodeRoom(rom, roomId);
    // The editor's header overrides (TM/TS/colour math) change how the layers composite.
    const room = withHeader(maps.applyObjectStates(rom, base, parseObjectStates(stateSpec)), header);
    const image = renderLayer(rom, room, layer);
    // The half of the room that is drawn over the characters standing in it,
    // so the Rooms tab can put enemies under the canopy the way the game does.
    // Composite only: a single-layer view has no foreground to speak of.
    const foreground = layer === 'composite' ? maps.renderRoomForeground(rom, room) : null;
    // Which tiles that foreground genuinely hides, so the overlay can dot
    // their collision rather than claiming the player can see it.
    const hidden = foreground ? maps.hiddenTileMask(room, foreground) : null;
    if (ov.any) maps.drawCollisionOverlay(image, room, Object.assign({}, ov.opts, { hidden }));
    const canopyOverlay = foreground && ov.any
        ? overlayOverCanopy(foreground, room, ov.opts, hidden) : null;
    const entry = {
        room,
        // Kept so the animation can re-apply the same overlay to its frames.
        // Measured lazily: it costs two more overlay passes and only matters
        // when animation is on.
        overlayOpts: ov.any ? ov.opts : null,
        features: maps.classifyRoom(room),
        imageUri: maps.encodePngDataUri(image),
        foregroundUri: foreground ? maps.encodePngDataUri(foreground) : null,
        // Kept so an animated room's canopy can be sent without its animated cells (foregroundFor).
        foreground,
        canopyOverlayUri: canopyOverlay ? maps.encodePngDataUri(canopyOverlay) : null,
        width: image.width,
        height: image.height,
    };

    RENDER_CACHE.set(key, entry);
    if (RENDER_CACHE.size > RENDER_CACHE_MAX) RENDER_CACHE.delete(RENDER_CACHE.keys().next().value);
    return entry;
}


// Animation overlays depend on everything the render does: the layer picks
// which words are on screen, the feature flags decide which pixels are
// overlay art to leave alone, and an object state rewrites the tilemap words
// that say which channel drives a cell. Keying this on the room alone meant
// switching the firepit in 0x25 to burning replayed its unlit channels (6-9)
// over the lit tiles (0-3) — so it shares the render's key.
const ANIM_CACHE = new Map();
const ANIM_CACHE_MAX = 6;

/** Refuse to ship an animation bigger than this; a patched ROM could be wild. */
const ANIM_MAX_BYTES = 1.5 * 1024 * 1024;
const ANIM_MAX_GROUPS = 800;

/**
 * Per-channel animation overlays for the Rooms tab, or null when the room has
 * none. Each group is a small transparent PNG covering a block of animated
 * cells, plus how long to hold each frame.
 */
function cachedAnimation(rom, key, layer, entry) {
    const room = entry.room;
    if (!room.animation.length) return null;
    const hit = ANIM_CACHE.get(key);
    if (hit !== undefined) return hit;

    let out = null;
    try {
        // An animated tile can also carry a contour, an object box or a
        // label. Measuring what the overlay does to each pixel lets those
        // marks be re-applied to every frame, so the tile animates *and*
        // stays annotated — freezing the marked pixels instead would have
        // stopped most of a room dead, since the wall tint alone covers 72%
        // of the pixels in 0x25.
        const overlay = entry.overlayOpts
            ? maps.buildOverlayTransfer(entry.width, entry.height,
                (img) => maps.drawCollisionOverlay(img, room, entry.overlayOpts))
            : null;
        const groups = maps.buildAnimationGroups(rom, room, { layer, overlay });
        let bytes = 0;
        const wire = groups.map((g) => ({
            x: g.x, y: g.y, w: g.w, h: g.h,
            delays: g.delaysMs,
            frames: g.frames.map((f) => {
                const uri = maps.encodePngDataUri(f);
                bytes += uri.length;
                return uri;
            }),
        }));
        out = (bytes > ANIM_MAX_BYTES || wire.length > ANIM_MAX_GROUPS)
            ? { groups: [], channels: room.animation.length, skipped: 'too large to stream' }
            : { groups: wire, channels: room.animation.length, bytes };
    } catch (err) {
        out = { groups: [], channels: room.animation.length, skipped: String(err && err.message || err) };
    }

    ANIM_CACHE.set(key, out);
    if (ANIM_CACHE.size > ANIM_CACHE_MAX) ANIM_CACHE.delete(ANIM_CACHE.keys().next().value);
    return out;
}

/**
 * The canopy picture to send. With animation on, the animated cells are cut
 * out of it: it is laid over the animation layer, and a still frame-0 copy
 * of a torch's canopy there covered every later frame. Measured once per
 * render and kept with it.
 */
function foregroundFor(entry, animate) {
    if (!animate || !entry.foreground || !entry.room.animation.length) return entry.foregroundUri;
    if (!entry.foregroundAnimUri) {
        entry.foregroundAnimUri = maps.encodePngDataUri(maps.clearAnimatedCells(entry.foreground, entry.room));
    }
    return entry.foregroundAnimUri;
}

/** Drop cached renders (call when the ROM changes). */
function invalidateRoomRenders() { RENDER_CACHE.clear(); PREVIEW_CACHE.clear(); ANIM_CACHE.clear(); }

/**
 * Decode and render a room for the Rooms tab.
 *
 * @param {Uint8Array|Buffer} rom  ROM buffer.
 * @param {number} roomId          Vanilla room id (0x00..0x7E).
 * @param {number} originX         SVG viewBox left edge, 8px-tile units.
 * @param {number} originY         SVG viewBox top edge, 8px-tile units.
 * @param {string} [layer]         'composite' (default), 'layer1' or 'layer2'.
 * @param {string} [overlay]       Feature flags from OVERLAY_FLAGS; omit for
 *                                 the full view, '' for a bare map.
 * @param {string} [objectStates]  `index:state` pairs joined by commas, e.g.
 *                                 '20:1'. Objects not listed show state 0.
 * @param {boolean} [animate]      Include the Section 2 animation overlays.
 */
function buildRoomTileOverlay(rom, roomId, originX, originY, layer, overlay, objectStates, animate, header) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const which = LAYERS.indexOf(layer) >= 0 ? layer : 'composite';
    const ov = overlayOptions(overlay);
    const spec = typeof objectStates === 'string' ? objectStates : '';
    const renderKey = romFingerprint(buf) + ':' + roomId + ':' + which + ':' + ov.flags + ':' + spec + ':' + headerSpec(header);
    const entry = cachedRender(buf, roomId, which, ov, spec, header);
    const { room, features, imageUri, canopyOverlayUri, width, height } = entry;
    const foregroundUri = foregroundFor(entry, animate);
    const collision = countCollision(room.collisionWords);

    return {
        roomId,
        layer: which,
        overlay: ov.flags,
        widthTiles: room.header.widthTiles,
        heightTiles: room.header.heightTiles,
        originX: originX || 0,
        originY: originY || 0,
        imageUri,
        foregroundUri,
        canopyOverlayUri,
        imageWidth: width,
        imageHeight: height,
        collisionTiles: collision.painted,
        drift: buildDrift(room.collisionWords),
        objects: cachedObjectPreviews(buf, roomId, room, parseObjectStates(spec)),
        objectStates: spec,
        grass: room.cuttableGrass.tiles.map((t) => ({ x: t[0], y: t[1] })),
        grassWarnings: room.cuttableGrass.warnings,
        elevationPlanes: room.elevationPlanes,
        mainPlane: features.mainPlane,
        gates: buildGates(features),
        transparentTiles: features.transparent.length,
        elevationChangeTiles: features.transitions.length,
        tileFamilies: room.tileFamilies,
        metatileCount: room.metatileCount,
        stepOnCount: room.triggers.stepOn.length,
        bTriggerCount: room.triggers.bTrigger.length,
        // The banners render_map.py bakes into the PNG. Passed as data so the
        // webview can draw them as HTML: always legible, and the raster stays
        // exactly the size of the map so it keeps lining up with the SVG layer.
        summary: maps.buildSummary(room, features),
        legend: maps.buildLegend(features, !!foregroundUri),
        animationChannels: room.animation.length,
        animation: animate ? cachedAnimation(buf, renderKey, which, entry) : null,
    };
}

module.exports = {
    buildRoomTileOverlay,
    overlayOptions,
    parseObjectStates,
    countCollision,
    buildDrift,
    buildObjects,
    invalidateRoomRenders,
    LAYERS,
    OVERLAY_FLAGS,
    ALL_OVERLAY_FLAGS,
};
