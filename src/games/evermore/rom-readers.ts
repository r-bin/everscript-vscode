// ROM reading functions for Memory Radar — extracted from extension.js
// The Evermore ROM comes from the ROM library (docs/architecture/multi-game.md §5): the selected
// ROM when it is Evermore, else the base ROM. `wsRoot` parameters are kept for the callers only.

import * as path from 'path';
import * as fs from 'fs';
import { romPath } from '..';

/** A room header and its trigger tables, as the Rooms tab shows them (null fields: the data ran out). */
interface RomMapHeader {
    offX: number; offY: number; mapW: number; mapH: number; mapWpx: number; mapHpx: number; scrollW: number; scrollH: number;
    b4: number; b5: number; b6: number; b7: number; b8: number; sig: string; renderPreset: string | null;
    unknownWord: number; b11: number; b12: number;
    stepLen: number | null; stepCount: number | null; bLen: number | null; bCount: number | null;
    payloadOffset: number | null; payloadTileCount: number | null; payloadTileIds: number[] | null;
}
/** One character record's name and stats. */
interface RomCharacter {
    id: number; name: string; hp: number; attack: number; defense: number; magic_defense: number; evade: number; hit_rate: number;
}
/** hit% by hit rate, then evade. */
type HitLookup = Record<number, Record<number, number>>;

/** Candidate ROM paths, in resolution order: an explicit path, then the library's Evermore ROM. */
function romCandidates(_wsRoot: unknown, romPathOverride = ''): string[] {
    return [romPathOverride, romPath('evermore')].filter((p): p is string => !!p);
}

// The ROM is ~3MB and the individual readers each re-read it. Cache the buffer
// keyed by path + mtime so repeated decodes (e.g. room tile overlays) are cheap.
let _romCache: { path: string; mtime: number; buf: Buffer } | null = null;

/** Load the workspace ROM as a Buffer, cached by path and mtime. Null if absent. */
function loadRomBuffer(wsRoot?: unknown, romPathOverride = ''): Buffer | null {
    try {
        for (const p of romCandidates(wsRoot, romPathOverride)) {
            if (!p || !fs.existsSync(p)) continue;
            const mtime = fs.statSync(p).mtimeMs;
            if (_romCache && _romCache.path === p && _romCache.mtime === mtime) return _romCache.buf;
            const buf = fs.readFileSync(p);
            _romCache = { path: p, mtime, buf };
            return buf;
        }
    } catch (_e) { /* fall through to null */ }
    return null;
}

/** The ROM file `loadRomBuffer` would read, or null when none exists. */
function resolveRomPath(wsRoot?: unknown, romPathOverride = ''): string | null {
    for (const p of romCandidates(wsRoot, romPathOverride)) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

// ROM files mounted as folders (`soe://rom/?rom=<path>`): one entry per path,
// so a mount never evicts the workspace ROM above.
const _fileCache = new Map<string, { mtime: number; buf: Buffer }>();

/** Load the ROM at an absolute path, cached by path and mtime. Null if unreadable. */
function loadRomFile(romPath: string): Buffer | null {
    try {
        const mtime = fs.statSync(romPath).mtimeMs;
        const hit = _fileCache.get(romPath);
        if (hit && hit.mtime === mtime) return hit.buf;
        const buf = fs.readFileSync(romPath);
        _fileCache.set(romPath, { mtime, buf });
        return buf;
    } catch (_e) {
        return null;
    }
}

/** Drop the cached ROM buffer (call when the ROM path setting changes). */
function invalidateRomBuffer() { _romCache = null; }

/** Read width/height from a PNG file header. Returns {w,h} or null. */
function readPngDimensions(filePath: string): { w: number; h: number } | null {
    try {
        const buf = Buffer.alloc(24);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buf, 0, 24, 0);
        fs.closeSync(fd);
        // PNG: 8-byte sig, then IHDR chunk (4 len + 4 "IHDR" + 4 width + 4 height)
        if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
            return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
        }
    } catch {}
    return null;
}

/**
 * Read trig_off_x / trig_off_y from the ROM data block for a map.
 * Bytes 0 and 1 of the data block are the trigger coordinate origin.
 * SVG formula: svg_x = (x1 - offX) * 2,  svg_y = (y1 - offY) * 2
 * (1 trigger-tile = 16px = 2 × 8px SVG tiles)
 * @param {string} wsRoot  Workspace root
 * @param {number} mapId   Numeric map ID (e.g. 0x5c)
 * @returns {{offX:number, offY:number}|null}
 */
function readRomTriggerOffsets(wsRoot: unknown, mapId: number): { offX: number; offY: number } | null {
    const h = readRomMapHeader(wsRoot, mapId);
    return h ? { offX: h.offX, offY: h.offY } : null;
}

/**
 * Read the full 13-byte ROM map header plus trigger table lengths and payload tile-set list.
 * Header layout (from traced data):
 *   [0]  trig_off_x        → 7E0F86  trigger rect origin X in 16px-tile units
 *   [1]  trig_off_y        → 7E0F88  trigger rect origin Y in 16px-tile units
 *   [2]  map_w_tiles       → 7E08EE  map width  in 16px tiles (× 16 = pixels)
 *   [3]  map_h_tiles       → 7E08F0  map height in 16px tiles (× 16 = pixels)
 *   [4]  room_render_preset→ 7E0F80 → TM $212C   display layer enables
 *   [5]  room_subscreen    → 7E0F81 → TS $212D   subscreen layer enables
 *   [6]  room_effect_family→ 7E0F82 → CGADSUB $2131  color math add/sub
 *   [7]  room_effect_enable→ 7E0F83 → CGWSEL $2130   color window/math master
 *   [8]  room_effect_variant→7E241F  per-room modifier within effect family
 *   [9-10] unknown_word    → 7E0F84  16-bit field; purpose not decoded
 *   [11] unknown_b11       (skipped by loader)
 *   [12] unknown_b12       (skipped by loader)
 * After header: step_len uint16, step-on table (6 bytes/entry), b_len uint16, B-trigger table.
 * Payload starts after trigger tables; first byte = tile-family count, then count×uint16 IDs.
 * @param {string} wsRoot
 * @param {number} mapId
 * @returns {object|null}
 */
function readRomMapHeader(wsRoot: unknown, mapId: number, romPathOverride = ''): RomMapHeader | null {
    if (mapId == null) return null;
    try {
        return readRomMapHeaderFrom(loadRomBuffer(wsRoot, romPathOverride) as Uint8Array, mapId);
    } catch { return null; }
}

/**
 * The same header, read from a ROM already in memory (a converted room's image,
 * src/games/evermore/imports/mana). Null when it cannot be read.
 * @param {Uint8Array} romBuf
 * @param {number} mapId
 */
function readRomMapHeaderFrom(romBuf: Uint8Array | null, mapId: number): RomMapHeader | null {
    if (!romBuf || mapId == null) return null;
    try {
        // Map pointer table at SNES 0x9ffde7 = ROM 0x1ffde7 (HiROM no header)
        const mapTableRom = 0x1ffde7;
        const ptrAddr = mapTableRom + mapId * 4;
        if (ptrAddr + 3 >= romBuf.length) return null;
        const dataSnes = romBuf[ptrAddr] | (romBuf[ptrAddr + 1] << 8) | (romBuf[ptrAddr + 2] << 16);
        const dataRom  = ((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff);
        if (dataRom + 20 >= romBuf.length) return null;
        const h   = (off: number): number => romBuf[dataRom + off];
        const h16 = (off: number): number => romBuf[dataRom + off] | (romBuf[dataRom + off + 1] << 8);
        const offX = h(0), offY = h(1);
        const mapW = h(2), mapH = h(3);
        const b4 = h(4), b5 = h(5), b6 = h(6), b7 = h(7), b8 = h(8);
        const unknownWord = h16(9);
        const b11 = h(11), b12 = h(12);
        // Derived geometry (1 tile = 16px; screen = 256×224)
        const mapWpx = mapW * 16, mapHpx = mapH * 16;
        const scrollW = Math.max(0, mapWpx - 256);
        const scrollH = Math.max(0, mapHpx - 224);
        // Render preset lookup (5-byte signature of bytes 4..8)
        const sig = [b4, b5, b6, b7, b8].map(v => v.toString(16).padStart(2, '0')).join(' ');
        const PRESETS: Record<string, string> = {
            '17 00 00 02 00': 'default outdoor / neutral',
            '17 11 02 02 00': 'indoor / interior',
            '17 01 42 02 00': 'cave / transition-heavy',
            '17 01 02 02 00': 'alternate special-area',
            '17 11 42 02 00': 'interior + cave/sewer hybrid',
            '17 00 00 02 02': 'parallax / layered-background',
            '16 01 92 02 01': 'darkness-style (Oglin cave)',
            '17 01 92 02 04': 'effect-heavy arena',
            '17 01 02 02 05': 'volcano variant',
            '17 05 42 02 00': 'boss / special-room',
            '17 12 41 02 00': 'cutscene / palace',
        };
        const renderPreset = PRESETS[sig] || null;
        // Trigger table lengths
        if (dataRom + 15 >= romBuf.length) return { offX, offY, mapW, mapH, mapWpx, mapHpx, scrollW, scrollH, b4, b5, b6, b7, b8, sig, renderPreset, unknownWord, b11, b12, stepLen: null, stepCount: null, bLen: null, bCount: null, payloadOffset: null, payloadTileCount: null, payloadTileIds: null };
        const stepLen   = h16(13);
        const stepCount = Math.floor(stepLen / 6);
        const bLenOff   = 15 + stepLen;
        if (dataRom + bLenOff + 2 >= romBuf.length) return { offX, offY, mapW, mapH, mapWpx, mapHpx, scrollW, scrollH, b4, b5, b6, b7, b8, sig, renderPreset, unknownWord, b11, b12, stepLen, stepCount, bLen: null, bCount: null, payloadOffset: null, payloadTileCount: null, payloadTileIds: null };
        const bLen       = h16(bLenOff);
        const bCount     = Math.floor(bLen / 6);
        const payloadOff = bLenOff + 2 + bLen;
        // Payload tile-set list: 1-byte count + count × uint16 tile-family IDs
        let payloadTileCount: number | null = null, payloadTileIds: number[] | null = null;
        if (dataRom + payloadOff < romBuf.length) {
            const tileCount = romBuf[dataRom + payloadOff];
            const tileEnd   = dataRom + payloadOff + 1 + tileCount * 2;
            if (tileCount <= 32 && tileEnd <= romBuf.length) {
                payloadTileCount = tileCount;
                payloadTileIds   = [];
                for (let i = 0; i < tileCount; i++) payloadTileIds.push(h16(payloadOff + 1 + i * 2));
            }
        }
        return { offX, offY, mapW, mapH, mapWpx, mapHpx, scrollW, scrollH, b4, b5, b6, b7, b8, sig, renderPreset, unknownWord, b11, b12, stepLen, stepCount, bLen, bCount, payloadOffset: payloadOff, payloadTileCount, payloadTileIds };
    } catch { return null; }
}

/**
 * Read all 142 character records from the ROM (HiROM, no header).
 * Base address: SNES 0x8eB678 → ROM 0x0EB678. Size: 0x4a bytes each.
 * @param {string} wsRoot
 * @returns {Array<{id,name,hp,attack,defense,magic_defense,evade,hit_rate}>}
 */
function readRomCharacters(wsRoot: unknown, romPathOverride = ''): RomCharacter[] {
    const CHAR_BASE = 0x0EB678;
    const CHAR_SIZE = 0x4a;
    const CHAR_COUNT = 142;
    const BOY_NAME_PTR = 0x7e2210;
    const DOG_NAME_PTR = 0x7e2234;
    try {
        const romBuf = loadRomBuffer(wsRoot, romPathOverride);
        if (!romBuf) return [];
        const chars: RomCharacter[] = [];
        for (let i = 0; i < CHAR_COUNT; i++) {
            const base = CHAR_BASE + i * CHAR_SIZE;
            if (base + CHAR_SIZE > romBuf.length) break;
            // 3-byte name pointer (LE)
            const namePtr = romBuf[base] | (romBuf[base + 1] << 8) | (romBuf[base + 2] << 16);
            let name = '';
            if (namePtr === BOY_NAME_PTR) {
                name = '<Boy>';
            } else if (namePtr === DOG_NAME_PTR) {
                name = '<Dog>';
            } else if (namePtr >= 0x800000 && namePtr < 0xd00000) {
                const nameRom = ((namePtr >> 16) & 0x3f) * 0x10000 + (namePtr & 0xffff);
                if (nameRom < romBuf.length) {
                    for (let j = nameRom; j < romBuf.length && j < nameRom + 32 && romBuf[j] !== 0; j++) {
                        name += String.fromCharCode(romBuf[j]);
                    }
                }
            }
            chars.push({
                id: i,
                name: name || ('#' + i),
                hp:            romBuf.readUInt16LE(base + 0x0f),
                attack:        romBuf.readUInt16LE(base + 0x19),
                defense:       romBuf.readUInt16LE(base + 0x1b),
              magic_defense: romBuf.readUInt16LE(base + 0x1d),
              evade:         romBuf.readUInt16LE(base + 0x1f),
                hit_rate:      romBuf.readUInt16LE(base + 0x21),
            });
        }
        return chars;
    } catch { return []; }
}

/**
 * Compute hit% lookup table from the two-level ROM table described in soestuff.lua.
 * Returns { hit_rate: { evade: pct } } for all unique (hit_rate, evade) pairs in chars.
 * Addresses: $8FBAAF (evasion pointer table), $8F0000 (hit value table) — HiROM, no header.
 */
function readRomHitLookup(wsRoot: unknown, chars: Partial<RomCharacter>[] | null | undefined): HitLookup {
    if (!chars || !chars.length) return {};
    try {
        const romBuf = loadRomBuffer(wsRoot);
        if (!romBuf) return {};
        // HiROM: ROM offset = (bank & 0x3F) * 0x10000 + addr16
        // 0x8FBAAF → 0x0F0000 + 0xBAAF = 0x0FBAAF
        // 0x8F0000 → 0x0F0000 + 0x0000 = 0x0F0000
        const PTR_BASE  = 0x0FBAAF;
        const HIT_BASE  = 0x0F0000;
        const calcHit = (hit_rate: number, evade: number): number | null => {
            const sprite_off = Math.floor((evade + 1) / 2) & 0xFFFE;
            const ptr_addr   = PTR_BASE + sprite_off;
            if (ptr_addr + 2 > romBuf.length) return null;
            const evasion_ptr = romBuf.readUInt16LE(ptr_addr);
            const hit_off    = ((hit_rate + 1) & 0xFFFC) >> 1;
            const final_addr = HIT_BASE + hit_off + evasion_ptr;
            if (final_addr + 2 > romBuf.length) return null;
            const raw = romBuf.readUInt16LE(final_addr);
            return Math.min(100, raw / 0x7FFF * 100);
        };
        const hitRates = new Set<number>([38, 50]);
        // Pre-compute all hit_rates Boy and Dog could have across L1–L37 (hitRateG=1)
        for (let hr = 1; hr <= 127; hr++) hitRates.add(hr);
        const evades   = new Set<number>([0]);
        for (const c of chars) {
            if (c.hit_rate !== undefined) hitRates.add(c.hit_rate);
            if (c.evade    !== undefined) evades.add(c.evade);
        }
        const lookup: HitLookup = {};
        for (const hr of hitRates) {
            const row: Record<number, number> = {};
            for (const ev of evades) {
                const pct = calcHit(hr, ev);
                if (pct !== null) row[ev] = Math.round(pct * 10) / 10;
            }
            if (Object.keys(row).length) lookup[hr] = row;
        }
        return lookup;
    } catch { return {}; }
}

/**
 * Check if scale_enemies is active (non-commented) in any main.evs in the workspace.
 * @param {string} wsRoot
 * @returns {boolean}
 */
function detectScaleEnemies(wsRoot: string | null | undefined, docPath?: string | null): boolean {
    if (!wsRoot) return false;
    try {
        // Walk up from docPath to find the nearest main.evs in its directory tree.
        // This scopes the warning to the build context of the current document.
        if (docPath) {
            let dir = path.dirname(docPath);
            while (dir.length >= wsRoot.length && dir.startsWith(wsRoot)) {
                const candidate = path.join(dir, 'main.evs');
                if (fs.existsSync(candidate)) {
                    const lines = fs.readFileSync(candidate, 'utf8').split('\n');
                    for (const line of lines) {
                        const trimmed = line.replace(/^\s+/, '');
                        if (trimmed.startsWith('//')) continue;
                        if (/scale_enemies\s*\(/.test(trimmed)) return true;
                    }
                    return false; // found main.evs but scale_enemies not active
                }
                const parent = path.dirname(dir);
                if (parent === dir) break;
                dir = parent;
            }
        }
        return false;
    } catch { return false; }
}

export type { RomMapHeader, RomCharacter, HitLookup };
export { loadRomFile, readPngDimensions, readRomTriggerOffsets, readRomMapHeader, readRomMapHeaderFrom, readRomCharacters, readRomHitLookup, detectScaleEnemies, loadRomBuffer, resolveRomPath, invalidateRomBuffer };
