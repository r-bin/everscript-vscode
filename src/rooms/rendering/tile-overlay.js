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
};

/** Every feature on — what a room shows before the user opts anything out. */
const ALL_OVERLAY_FLAGS = Object.keys(OVERLAY_FLAGS).join('');

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

function renderLayer(rom, room, layer) {
    if (layer === 'layer1') return maps.renderVramLayer(rom, room, room.layer1VramWords);
    if (layer === 'layer2') return maps.renderVramLayer(rom, room, room.layer2VramWords);
    return maps.renderRoomComposite(rom, room);
}

function cachedRender(rom, roomId, layer, ov, stateSpec) {
    const key = romFingerprint(rom) + ':' + roomId + ':' + layer + ':' + ov.flags + ':' + stateSpec;
    const hit = RENDER_CACHE.get(key);
    if (hit) return hit;

    // Stamp the chosen states in before rendering, so the map shows the chest
    // open or the bridge extended. Collision follows automatically: it is
    // looked up from the same metatile ID the stamp rewrites.
    const base = maps.decodeRoom(rom, roomId);
    const room = maps.applyObjectStates(rom, base, parseObjectStates(stateSpec));
    const image = renderLayer(rom, room, layer);
    if (ov.any) maps.drawCollisionOverlay(image, room, ov.opts);
    const entry = {
        room,
        features: maps.classifyRoom(room),
        imageUri: maps.encodePngDataUri(image),
        width: image.width,
        height: image.height,
    };

    RENDER_CACHE.set(key, entry);
    if (RENDER_CACHE.size > RENDER_CACHE_MAX) RENDER_CACHE.delete(RENDER_CACHE.keys().next().value);
    return entry;
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

// Animation overlays are expensive to encode and unaffected by the feature
// flags or object states, so they are cached on the ROM and room alone.
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
function cachedAnimation(rom, roomId, room) {
    if (!room.animation.length) return null;
    const key = romFingerprint(rom) + ':' + roomId;
    const hit = ANIM_CACHE.get(key);
    if (hit !== undefined) return hit;

    let out = null;
    try {
        const groups = maps.buildAnimationGroups(rom, room);
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
function buildRoomTileOverlay(rom, roomId, originX, originY, layer, overlay, objectStates, animate) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const which = LAYERS.indexOf(layer) >= 0 ? layer : 'composite';
    const ov = overlayOptions(overlay);
    const spec = typeof objectStates === 'string' ? objectStates : '';
    const { room, features, imageUri, width, height } = cachedRender(buf, roomId, which, ov, spec);
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
        legend: maps.buildLegend(features),
        animationChannels: room.animation.length,
        animation: animate ? cachedAnimation(buf, roomId, room) : null,
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
