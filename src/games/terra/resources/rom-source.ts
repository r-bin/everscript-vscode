// Ownership: reading and caching the Terranigma ROM terra:// serves. Which file comes from the ROM library
// (docs/architecture/multi-game.md §5), injected by extension.ts; a file is only accepted after its title check.

import * as fs from 'fs';
import { isTerraRom } from '../decoder';

let cache: { path: string; mtime: number; rom: Uint8Array } | null = null;

export function readTerraRom(file: string | null | undefined): Uint8Array | null {
    if (!file) return null;
    try {
        const mtime = fs.statSync(file).mtimeMs;
        if (cache && cache.path === file && cache.mtime === mtime) return cache.rom;
        const rom = new Uint8Array(fs.readFileSync(file));
        if (!isTerraRom(rom)) return null;
        cache = { path: file, mtime, rom };
        return rom;
    } catch {
        return null;
    }
}
