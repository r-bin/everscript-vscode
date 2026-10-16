'use strict';
// Ownership: reading and caching the Secret of Mana ROM `som://` serves.
//
// Which file that is comes from the ROM library (docs/architecture/multi-game.md §5), injected
// by extension.js. A file is only accepted after its title check, so a wrong path never serves
// Evermore data.

const fs = require('fs');
const { isManaRom } = require('../mana');

/** @type {{ path: string, mtime: number, rom: Uint8Array } | null} */
let cache = null;

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
 * @param {{ path?: string | null }} where
 * @returns {{ path: string, rom: Uint8Array } | null}
 */
function findManaRom(where) {
    const rom = where.path ? readRom(where.path) : null;
    return rom ? { path: where.path, rom } : null;
}

module.exports = { findManaRom };
