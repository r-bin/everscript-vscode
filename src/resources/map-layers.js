'use strict';
// Ownership: Individual layer rendering (Layer 1, Layer 2) and block collision rendering
// for map rooms, metatiles, and atlases. Pure.

const { renderVramLayer } = require('../maps/dist/render');
const { geometryMask, isAlwaysWalkable, tilePlane } = require('../maps/dist/collision');
const { PLANE_COLORS } = require('../maps/dist/collision-overlay');
const { renderMetatileAtlas, metatileTable } = require('../maps/dist/metatiles');
const { encodeGif } = require('./gif');
const { getAnimationSchedule } = require('./map-animation');

const _layerCache = new WeakMap();
const _collCache = new WeakMap();
const _layerGifCache = new WeakMap();
const _collGifCache = new WeakMap();
const _mtCollCache = new WeakMap();
const _atlasCollCache = new WeakMap();

/**
 * Render Layer 1 (canopy) or Layer 2 (terrain) for a room as RGBA pixels.
 */
function renderRoomLayer(rom, room, layerName) {
    let map = _layerCache.get(rom);
    if (!map) {
        map = new Map();
        _layerCache.set(rom, map);
    }
    const rId = room.roomId ?? room.id ?? 0;
    const key = `${rId}:${layerName}`;
    if (map.has(key)) return map.get(key);

    const words = layerName === 'layer1' ? room.layer1VramWords : room.layer2VramWords;
    const img = renderVramLayer(rom, room, words);
    map.set(key, img);
    return img;
}

/**
 * Render the room's collision layer as block geometry (triangles, squares, half-squares)
 * with colors corresponding to each tile's elevation plane level.
 */
function renderRoomCollision(room) {
    const rId = room.roomId ?? room.id ?? 0;
    if (_collCache.has(room)) return _collCache.get(room);

    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;
    const w = wTiles * 16;
    const h = hTiles * 16;
    const data = new Uint8Array(w * h * 4);
    const cw = room.collisionWords;

    for (let tr = 0; tr < hTiles; tr++) {
        for (let tc = 0; tc < wTiles; tc++) {
            const word = cw[tr][tc];
            if (isAlwaysWalkable(word)) continue;
            const code = word & 0x0f;
            if (!code) continue;
            const mask = geometryMask(code);
            const plane = tilePlane(word);
            const [r, g, b] = PLANE_COLORS[plane] || PLANE_COLORS[1];
            for (let py = 0; py < 16; py++) {
                for (let px = 0; px < 16; px++) {
                    if (mask[py * 16 + px]) {
                        const o = ((tr * 16 + py) * w + (tc * 16 + px)) * 4;
                        data[o] = r;
                        data[o + 1] = g;
                        data[o + 2] = b;
                        data[o + 3] = 255;
                    }
                }
            }
        }
    }

    const img = { width: w, height: h, data };
    _collCache.set(room, img);
    return img;
}

/**
 * Render an individual layer (layer1 or layer2) animated GIF across Section 2 channels.
 */
function renderRoomLayerGif(rom, room, layerName) {
    let map = _layerGifCache.get(rom);
    if (!map) {
        map = new Map();
        _layerGifCache.set(rom, map);
    }
    const rId = room.roomId ?? room.id ?? 0;
    const key = `${rId}:${layerName}`;
    if (map.has(key)) return map.get(key);

    const w = room.header.widthTiles * 16;
    const h = room.header.heightTiles * 16;
    const channels = room.animation || [];

    if (!channels.length) {
        const base = renderRoomLayer(rom, room, layerName);
        const gif = encodeGif(w, h, [{ data: base.data, ticks: 60 }]);
        map.set(key, gif);
        return gif;
    }

    const maxSteps = (w * h > 500000) ? 4 : 12;
    const { steps, ticks } = getAnimationSchedule(room, maxSteps);
    const frames = [];

    for (let s = 0; s < steps; s++) {
        const tiles = room.animatedTiles.slice();
        for (let c = 0; c < channels.length; c++) {
            const f = channels[c].frames;
            if (f.length > 0) {
                tiles[c] = f[s % f.length].tileId;
            }
        }
        const staged = { ...room, animatedTiles: tiles };
        const words = layerName === 'layer1' ? staged.layer1VramWords : staged.layer2VramWords;
        const img = renderVramLayer(rom, staged, words);
        frames.push({ data: img.data, ticks });
    }

    const gif = encodeGif(w, h, frames);
    map.set(key, gif);
    return gif;
}

/**
 * Render the collision layer as an animated GIF (1 frame, looping).
 */
function renderRoomCollisionGif(room) {
    if (_collGifCache.has(room)) return _collGifCache.get(room);

    const img = renderRoomCollision(room);
    const gif = encodeGif(img.width, img.height, [{ data: img.data, ticks: 60 }]);
    _collGifCache.set(room, gif);
    return gif;
}

/**
 * Render a 16x16 pixel buffer for an individual metatile's collision geometry.
 */
function renderMetatileCollision(room, idx) {
    let map = _mtCollCache.get(room);
    if (!map) {
        map = new Map();
        _mtCollCache.set(room, map);
    }
    if (map.has(idx)) return map.get(idx);

    const table = metatileTable(room);
    const m = table[idx];
    const data = new Uint8Array(16 * 16 * 4);

    if (m && !isAlwaysWalkable(m.collision)) {
        const code = m.collision & 0x0f;
        if (code) {
            const mask = geometryMask(code);
            const plane = tilePlane(m.collision);
            const [r, g, b] = PLANE_COLORS[plane] || PLANE_COLORS[1];
            for (let py = 0; py < 16; py++) {
                for (let px = 0; px < 16; px++) {
                    if (mask[py * 16 + px]) {
                        const o = (py * 16 + px) * 4;
                        data[o] = r;
                        data[o + 1] = g;
                        data[o + 2] = b;
                        data[o + 3] = 255;
                    }
                }
            }
        }
    }

    const img = { width: 16, height: 16, data };
    map.set(idx, img);
    return img;
}

/**
 * Render the metatile collision atlas grid.
 */
function renderMetatileAtlasCollision(room, opts = {}) {
    const columns = Math.max(1, opts.columns || 16);
    const count = room.metatileCount;
    const rows = Math.max(1, Math.ceil(count / columns));
    const w = columns * 16;
    const h = rows * 16;
    const data = new Uint8Array(w * h * 4);
    const table = metatileTable(room);

    for (let idx = 0; idx < count; idx++) {
        const col = idx % columns;
        const row = Math.floor(idx / columns);
        const word = table[idx].collision;
        if (isAlwaysWalkable(word)) continue;
        const code = word & 0x0f;
        if (!code) continue;
        const mask = geometryMask(code);
        const plane = tilePlane(word);
        const [r, g, b] = PLANE_COLORS[plane] || PLANE_COLORS[1];
        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                if (mask[py * 16 + px]) {
                    const o = (((row * 16 + py) * w) + (col * 16 + px)) * 4;
                    data[o] = r;
                    data[o + 1] = g;
                    data[o + 2] = b;
                    data[o + 3] = 255;
                }
            }
        }
    }

    return { image: { width: w, height: h, data }, columns, rows, cell: 16, count };
}

module.exports = {
    renderRoomLayer,
    renderRoomCollision,
    renderRoomLayerGif,
    renderRoomCollisionGif,
    renderMetatileCollision,
    renderMetatileAtlasCollision,
};
