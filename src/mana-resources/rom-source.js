'use strict';
// Ownership: finding and caching the Secret of Mana ROM `som://` serves.
//
// Order: the `everscript.manaRomPath` setting; `everscript.romPath` when that
// file is a Mana ROM; then any .smc/.sfc next to `romPath` or in the first
// workspace folder whose internal title says Secret of Mana. A file is only
// accepted after its title check, so a wrong path never serves Evermore data.

const fs = require('fs');
const path = require('path');
const { isManaRom } = require('../mana');

/** @type {{ path: string, mtime: number, rom: Uint8Array } | null} */
let cache = null;

/**
 * @param {{ manaRomPath?: string, romPath?: string, wsRoot?: string | null }} where
 * @returns {string[]}
 */
function candidates(where) {
    const out = [];
    if (where.manaRomPath) out.push(where.manaRomPath);
    if (where.romPath) out.push(where.romPath);
    for (const dir of [where.romPath && path.dirname(where.romPath), where.wsRoot]) {
        if (!dir) continue;
        let names = [];
        try { names = fs.readdirSync(dir); } catch { continue; }
        for (const n of names) if (/\.(smc|sfc)$/i.test(n) && /mana/i.test(n)) out.push(path.join(dir, n));
    }
    return [...new Set(out)];
}

/** @param {string} file @returns {Uint8Array | null} */
function readRom(file) {
    try {
        const mtime = fs.statSync(file).mtimeMs;
        if (cache && cache.path === file && cache.mtime === mtime) return cache.rom;
        const rom = new Uint8Array(fs.readFileSync(file));
        if (!isManaRom(rom)) return null;
        cache = { path: file, mtime, rom };
        return rom;
    } catch {
        return null;
    }
}

/**
 * @param {{ manaRomPath?: string, romPath?: string, wsRoot?: string | null }} where
 * @returns {{ path: string, rom: Uint8Array } | null}
 */
function findManaRom(where) {
    for (const file of candidates(where)) {
        const rom = readRom(file);
        if (rom) return { path: file, rom };
    }
    return null;
}

module.exports = { findManaRom, candidates };
