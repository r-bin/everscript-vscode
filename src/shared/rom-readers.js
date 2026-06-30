'use strict';
// ROM reading functions for Memory Radar — extracted from extension.js
// All functions read from the workspace ROM file (HiROM, no header).

const path = require('path');
const fs   = require('fs');

/** Read width/height from a PNG file header. Returns {w,h} or null. */
function readPngDimensions(filePath) {
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
function readRomTriggerOffsets(wsRoot, mapId) {
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
function readRomMapHeader(wsRoot, mapId, romPathOverride = '') {
    if (!wsRoot || mapId == null) return null;
    try {
        const romCandidates = [];
        if (romPathOverride) romCandidates.push(romPathOverride);
        romCandidates.push(path.join(wsRoot, 'Secret of Evermore (U) [!].smc'));
        romCandidates.push(path.join(wsRoot, 'Secret of Evermore.smc'));
        let romBuf = null;
        for (const p of romCandidates) {
            if (p && fs.existsSync(p)) { romBuf = fs.readFileSync(p); break; }
        }
        if (!romBuf) return null;
        // Map pointer table at SNES 0x9ffde7 = ROM 0x1ffde7 (HiROM no header)
        const mapTableRom = 0x1ffde7;
        const ptrAddr = mapTableRom + mapId * 4;
        if (ptrAddr + 3 >= romBuf.length) return null;
        const dataSnes = romBuf[ptrAddr] | (romBuf[ptrAddr + 1] << 8) | (romBuf[ptrAddr + 2] << 16);
        const dataRom  = ((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff);
        if (dataRom + 20 >= romBuf.length) return null;
        const h   = (off) => romBuf[dataRom + off];
        const h16 = (off) => romBuf[dataRom + off] | (romBuf[dataRom + off + 1] << 8);
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
        const PRESETS = {
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
        let payloadTileCount = null, payloadTileIds = null;
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
function readRomCharacters(wsRoot) {
    if (!wsRoot) return [];
    const CHAR_BASE = 0x0EB678;
    const CHAR_SIZE = 0x4a;
    const CHAR_COUNT = 142;
    const BOY_NAME_PTR = 0x7e2210;
    const DOG_NAME_PTR = 0x7e2234;
    try {
        const romNames = ['Secret of Evermore (U) [!].smc', 'Secret of Evermore.smc'];
        let romBuf = null;
        for (const name of romNames) {
            const p = path.join(wsRoot, name);
            if (fs.existsSync(p)) { romBuf = fs.readFileSync(p); break; }
        }
        if (!romBuf) return [];
        const chars = [];
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
function readRomHitLookup(wsRoot, chars) {
    if (!wsRoot || !chars || !chars.length) return {};
    try {
        const romNames = ['Secret of Evermore (U) [!].smc', 'Secret of Evermore.smc'];
        let romBuf = null;
        for (const name of romNames) {
            const p = path.join(wsRoot, name);
            if (fs.existsSync(p)) { romBuf = fs.readFileSync(p); break; }
        }
        if (!romBuf) return {};
        // HiROM: ROM offset = (bank & 0x3F) * 0x10000 + addr16
        // 0x8FBAAF → 0x0F0000 + 0xBAAF = 0x0FBAAF
        // 0x8F0000 → 0x0F0000 + 0x0000 = 0x0F0000
        const PTR_BASE  = 0x0FBAAF;
        const HIT_BASE  = 0x0F0000;
        const calcHit = (hit_rate, evade) => {
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
        const hitRates = new Set([38, 50]);
        // Pre-compute all hit_rates Boy and Dog could have across L1–L37 (hitRateG=1)
        for (let hr = 1; hr <= 127; hr++) hitRates.add(hr);
        const evades   = new Set([0]);
        for (const c of chars) {
            if (c.hit_rate !== undefined) hitRates.add(c.hit_rate);
            if (c.evade    !== undefined) evades.add(c.evade);
        }
        const lookup = {};
        for (const hr of hitRates) {
            const row = {};
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
function detectScaleEnemies(wsRoot, docPath) {
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

module.exports = {
    readPngDimensions,
    readRomTriggerOffsets,
    readRomMapHeader,
    readRomCharacters,
    readRomHitLookup,
    detectScaleEnemies,
};
