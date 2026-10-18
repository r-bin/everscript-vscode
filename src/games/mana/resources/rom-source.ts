// Ownership: reading and caching the Secret of Mana ROM `som://` serves.
//
// Which file that is comes from the ROM library (docs/architecture/multi-game.md §5), injected
// by extension.js. A file is only accepted after its title check, so a wrong path never serves
// Evermore data.

import * as fs from 'fs';
import { isManaRom } from '../decoder';

let cache: { path: string; mtime: number; rom: Uint8Array; } | null = null;

function readRom(file: string): Uint8Array | null {
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

function findManaRom(where: { path?: string | null; }): { path: string; rom: Uint8Array; } | null {
    const file = where.path;
    const rom = file ? readRom(file) : null;
    return file && rom ? { path: file, rom } : null;
}

export { findManaRom };
