'use strict';
// Ownership: Animated GIF generation for map rooms and metatiles.
// Visualizes animated tile channels in motion. Pure.

const { renderRoomComposite } = require('../maps/dist/render');
const { renderMetatileAtlas } = require('../maps/dist/metatiles');
const { encodeGif } = require('./gif');

const _roomGifCache = new WeakMap();
const _atlasGifCache = new WeakMap();
const _metatileGifCache = new WeakMap();

function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function lcm(a, b) { return a && b ? (a / gcd(a, b)) * b : (a || b || 1); }

function getAnimationSchedule(room, maxSteps = 12) {
    const channels = room.animation || [];
    if (!channels.length) return { steps: 1, ticks: 60 };

    const frameCounts = channels.map((c) => c.frames.length).filter((n) => n > 1);
    if (!frameCounts.length) return { steps: 1, ticks: 60 };

    let steps = frameCounts.reduce((a, b) => lcm(a, b), 1);
    if (steps > maxSteps) {
        const smaller = frameCounts.filter((n) => n <= maxSteps);
        steps = smaller.length > 0 ? Math.min(...smaller) : maxSteps;
    }
    if (!Number.isFinite(steps) || steps < 2) steps = Math.min(maxSteps, 2);

    const delays = channels.flatMap((c) => c.frames.map((f) => f.delay)).filter((d) => d > 0);
    const avgTicks = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 8;
    const ticks = Math.max(4, Math.min(30, avgTicks));

    return { steps, ticks };
}

function renderRoomAnimationGif(rom, room) {
    let map = _roomGifCache.get(rom);
    if (!map) {
        map = new Map();
        _roomGifCache.set(rom, map);
    }
    const rId = room.roomId ?? room.id ?? 0;
    if (map.has(rId)) return map.get(rId);

    const w = room.header.widthTiles * 16;
    const h = room.header.heightTiles * 16;
    const channels = room.animation || [];

    if (!channels.length) {
        const base = renderRoomComposite(rom, room);
        const gif = encodeGif(w, h, [{ data: base.data, ticks: 60 }]);
        map.set(rId, gif);
        return gif;
    }

    // For large maps (>500k pixels), cap steps to 4 for responsive encoding
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
        const img = renderRoomComposite(rom, staged);
        frames.push({ data: img.data, ticks });
    }

    const gif = encodeGif(w, h, frames);
    map.set(rId, gif);
    return gif;
}

function renderMetatileAtlasAnimationGif(rom, room) {
    let map = _atlasGifCache.get(rom);
    if (!map) {
        map = new Map();
        _atlasGifCache.set(rom, map);
    }
    const rId = room.roomId ?? room.id ?? 0;
    if (map.has(rId)) return map.get(rId);

    const channels = room.animation || [];
    if (!channels.length) {
        const atlas = renderMetatileAtlas(rom, room);
        const gif = encodeGif(atlas.image.width, atlas.image.height, [{ data: atlas.image.data, ticks: 60 }]);
        map.set(rId, gif);
        return gif;
    }

    const { steps, ticks } = getAnimationSchedule(room);
    const frames = [];
    let atlasWidth = 0;
    let atlasHeight = 0;

    for (let s = 0; s < steps; s++) {
        const tiles = room.animatedTiles.slice();
        for (let c = 0; c < channels.length; c++) {
            const f = channels[c].frames;
            if (f.length > 0) {
                tiles[c] = f[s % f.length].tileId;
            }
        }
        const staged = { ...room, animatedTiles: tiles };
        const atlas = renderMetatileAtlas(rom, staged);
        atlasWidth = atlas.image.width;
        atlasHeight = atlas.image.height;
        frames.push({ data: atlas.image.data, ticks });
    }

    const gif = encodeGif(atlasWidth, atlasHeight, frames);
    map.set(rId, gif);
    return gif;
}

function getWordChannel(room, word) {
    const charIdx = word & 0x03ff;
    const slot = Math.floor(charIdx / 0x20) * 8 + Math.floor((charIdx % 0x20) / 2);
    const nPal = room.tilePalette.length;
    const ch = slot - nPal;
    return (ch >= 0 && ch < (room.animation || []).length) ? ch : -1;
}

function isChannelActive(room, ch) {
    const c = (room.animation || [])[ch];
    return Boolean(c && c.frames && c.frames.length > 1);
}

function isLayerAnimated(room, layerName) {
    const channels = room.animation || [];
    const active = new Set(
        channels.map((c, i) => (c.frames && c.frames.length > 1 ? i : -1)).filter((i) => i >= 0)
    );
    if (!active.size) return false;

    const words = layerName === 'layer1' ? room.layer1VramWords : room.layer2VramWords;
    if (!words) return false;

    for (const row of words) {
        for (const w of row) {
            const ch = getWordChannel(room, w);
            if (active.has(ch)) return true;
        }
    }
    return false;
}

function isRoomAnimated(room) {
    return isLayerAnimated(room, 'layer1') || isLayerAnimated(room, 'layer2');
}

function isCollisionAnimated(_room) {
    return false;
}

function isMetatileAnimated(room, m) {
    const ch1 = getWordChannel(room, m.layer1);
    const ch2 = getWordChannel(room, m.layer2);
    const channels = [];
    if (ch1 >= 0 && isChannelActive(room, ch1)) channels.push(ch1);
    if (ch2 >= 0 && ch2 !== ch1 && isChannelActive(room, ch2)) channels.push(ch2);
    return {
        animated: channels.length > 0,
        channels,
    };
}

function renderMetatileAnimationGif(rom, room, idx) {
    let map = _metatileGifCache.get(rom);
    if (!map) {
        map = new Map();
        _metatileGifCache.set(rom, map);
    }
    const rId = room.roomId ?? room.id ?? 0;
    const key = `${rId}:${idx}`;
    if (map.has(key)) return map.get(key);

    const channels = room.animation || [];
    const cell = 16;

    if (!channels.length) {
        const atlas = renderMetatileAtlas(rom, room);
        const col = idx % atlas.columns;
        const row = Math.floor(idx / atlas.columns);
        const data = extractCell(atlas.image, col, row, cell);
        const gif = encodeGif(cell, cell, [{ data, ticks: 60 }]);
        map.set(key, gif);
        return gif;
    }

    const { steps, ticks } = getAnimationSchedule(room);
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
        const atlas = renderMetatileAtlas(rom, staged);
        const col = idx % atlas.columns;
        const row = Math.floor(idx / atlas.columns);
        const data = extractCell(atlas.image, col, row, cell);
        frames.push({ data, ticks });
    }

    const gif = encodeGif(cell, cell, frames);
    map.set(key, gif);
    return gif;
}

function extractCell(image, col, row, cell) {
    const data = new Uint8Array(cell * cell * 4);
    for (let y = 0; y < cell; y++) {
        const srcY = row * cell + y;
        for (let x = 0; x < cell; x++) {
            const srcX = col * cell + x;
            const srcO = (srcY * image.width + srcX) * 4;
            const dstO = (y * cell + x) * 4;
            data[dstO] = image.data[srcO];
            data[dstO + 1] = image.data[srcO + 1];
            data[dstO + 2] = image.data[srcO + 2];
            data[dstO + 3] = image.data[srcO + 3];
        }
    }
    return data;
}

module.exports = {
    getAnimationSchedule,
    renderRoomAnimationGif,
    renderMetatileAtlasAnimationGif,
    renderMetatileAnimationGif,
    isMetatileAnimated,
    isLayerAnimated,
    isRoomAnimated,
    isCollisionAnimated,
};
