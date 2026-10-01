'use strict';
// Ownership: the ring menu's item icons as PNG data URIs, keyed by the names
// the webview already has — a loot reward's `LOOT_REWARD` name (`CRYSTAL`,
// `PETAL`, `CHEST_1_1`) and an alchemy formula's name (`Acid Rain`).
//
// The decoding is src/maps/item-icons.ts and is pure; this only joins it to
// src/script/'s names and encodes the pixels. Every icon comes from the
// user's ROM at run time — nothing is bundled. docs/item-icons.md.

const { renderItemIcon, lootIconId, alchemyIconId, ALCHEMY_FORMULAS, encodePngDataUri } = require('../../maps');
const { lootRewardName, ramBitToStr } = require('../../script');

/** The reward categories the ring menu draws: ingredients, armour, consumables. */
const REWARD_CATEGORIES = [0x0200, 0x0400, 0x0800];

/** Each formula's "known" flag is one bit from here, alphabetical. */
const ALCHEMY_KNOWN = 0x2258;

// Keyed by the ROM buffer, so a ROM swapped on disk (a new mtime, a new
// buffer from rom-readers) is decoded afresh and the old entry can go.
const _cache = new WeakMap();

function iconUri(rom, id) {
    if (id === null) return null;
    const px = renderItemIcon(rom, id);
    return px ? encodePngDataUri(centreIcon(px)) : null;
}

/**
 * The same frame, its opaque pixels moved to the middle. The ring menu's art
 * sits in the top-left of its 16×16 frame (most are ~12px, centred near 6,6),
 * so drawn centred on a trigger the icon landed up and to the left of it.
 */
function centreIcon(px) {
    const { width: w, height: h, data } = px;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!data[(y * w + x) * 4 + 3]) continue;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    }
    if (x1 < 0) return px;
    const dx = Math.floor((w - (x1 - x0 + 1)) / 2) - x0;
    const dy = Math.floor((h - (y1 - y0 + 1)) / 2) - y0;
    if (!dx && !dy) return px;
    const out = new Uint8Array(data.length);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const from = (y * w + x) * 4;
            const to = ((y + dy) * w + x + dx) * 4;
            for (let c = 0; c < 4; c++) out[to + c] = data[from + c];
        }
    }
    return { width: w, height: h, data: out };
}

/** `(Acid Rain) ` → `Acid Rain`; '' when the flag has no name. */
function flagName(addr, bit) {
    const m = /^\((.*)\) $/.exec(ramBitToStr(addr, bit));
    return m ? m[1] : '';
}

/**
 * `{ loot: {NAME: dataUri}, alchemy: {Name: dataUri} }` for a ROM buffer, or
 * empty maps without one — the webview then falls back to its emoji.
 */
function buildItemIcons(rom) {
    if (!rom) return { loot: {}, alchemy: {} };
    const hit = _cache.get(rom);
    if (hit) return hit;
    const bytes = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const loot = {};
    for (const base of REWARD_CATEGORIES) {
        for (let i = 0; i < 0x100; i++) {
            const name = lootRewardName(base + i);
            if (!name) continue;
            const uri = iconUri(bytes, lootIconId(bytes, base + i));
            if (uri) loot[name] = uri;
        }
    }
    const alchemy = {};
    for (let n = 0; n < ALCHEMY_FORMULAS; n++) {
        const name = flagName(ALCHEMY_KNOWN + (n >> 3), n & 7);
        if (!name) continue;
        const uri = iconUri(bytes, alchemyIconId(bytes, n));
        if (uri) alchemy[name] = uri;
    }
    const out = { loot, alchemy };
    _cache.set(rom, out);
    return out;
}

module.exports = { buildItemIcons };
