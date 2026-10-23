// Ownership: Centralized ASM comments and labels for Secret of Evermore routines.
// Read by asm-view.ts (infusing disassembly), Mesen export, Asar export, and the VFS.

import * as fs from 'fs';
import * as path from 'path';
import { hiromFileOffset } from '../../../platform/snes/hirom';
import { sourceDir } from '../../../platform/source-dir';

interface AsmComment {
    comment?: string;
    label?: string;
}

interface CommentsData {
    rom?: Record<string, AsmComment>;
    wram?: Record<string, AsmComment>;
    [key: string]: Record<string, AsmComment> | undefined;
}

let loadedData: CommentsData | null = null;

function loadComments(): CommentsData {
    if (loadedData) return loadedData;
    const jsonPath = path.join(sourceDir(__dirname), 'data', 'asm-comments.json');
    if (fs.existsSync(jsonPath)) {
        try {
            loadedData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch {
            loadedData = { rom: {} };
        }
    } else {
        loadedData = { rom: {} };
    }
    return loadedData!;
}

/** Formats an offset as a 6-digit uppercase hex string. */
function toHex6(num: number): string {
    return (num >>> 0).toString(16).padStart(6, '0').toUpperCase();
}

/** Formats a WRAM offset as a 4-digit or 5-digit uppercase hex string. */
function toHex4(num: number): string {
    return (num >>> 0).toString(16).padStart(4, '0').toUpperCase();
}

/**
 * Look up comment/label for a ROM address (bus address or file offset).
 */
function getRomComment(addrOrOffset: number): AsmComment | null {
    const data = loadComments();
    const romMap = data.rom || {};
    const off = hiromFileOffset(addrOrOffset);
    const key = toHex6(off);
    if (romMap[key]) return romMap[key];
    const busKey = toHex6(addrOrOffset);
    if (romMap[busKey]) return romMap[busKey];
    return null;
}

/**
 * Look up comment/label for a WRAM address ($7E0000-$7FFFFF or 0x0000-0x1FFFF).
 */
function getWramComment(wramAddr: number): AsmComment | null {
    const data = loadComments();
    const wramMap = data.wram || {};
    const off = wramAddr >= 0x7E0000 ? wramAddr - 0x7E0000 : wramAddr;
    const key = toHex4(off);
    if (wramMap[key]) return wramMap[key];
    return null;
}

/** Returns all ROM comments as a Map of file offset -> AsmComment. */
function getAllRomComments(): Map<number, AsmComment> {
    const data = loadComments();
    const out = new Map<number, AsmComment>();
    for (const [k, v] of Object.entries(data.rom || {})) {
        const off = parseInt(k, 16);
        if (!isNaN(off)) out.set(off, v);
    }
    return out;
}

/** Invalidate cache (used during testing / reload). */
function invalidateCommentsCache(): void {
    loadedData = null;
}

export type { AsmComment, CommentsData };
export { getRomComment, getWramComment, getAllRomComments, invalidateCommentsCache, loadComments };
