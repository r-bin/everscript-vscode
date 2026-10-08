'use strict';

/**
 * emulator/cdl/rom-map.js
 *
 * ROM offset <-> SNES bus address for the export. Every ROM byte gets one
 * canonical address (HiROM: $C0-$FF, ExHiROM upper half: $40-$7D, LoROM:
 * $80-$FF:8000-FFFF); busToRom resolves any mirror back to the offset.
 */

const { parseSnesRomHeader } = require('../snes-rom-header-model');

function createRomMap(rom) {
    const header = parseSnesRomHeader(Buffer.from(rom.buffer, rom.byteOffset, rom.length));
    const type = header ? header.layout : 'HiROM';
    const size = rom.length;
    const lo = type === 'LoROM';
    const segment = lo ? 0x8000 : 0x10000;

    function canonical(off) {
        if (lo) return ((0x80 + (off >> 15)) << 16) | 0x8000 | (off & 0x7FFF);
        if (off < 0x400000) return 0xC00000 + off;
        return 0x400000 + (off - 0x400000);
    }

    function busToRom(addr) {
        const bank = (addr >>> 16) & 0xFF;
        const a = addr & 0xFFFF;
        if (bank === 0x7E || bank === 0x7F) return -1;
        let off;
        if (lo) {
            if (a < 0x8000) return -1;
            off = ((bank & 0x7F) << 15) | (a & 0x7FFF);
        } else if (type === 'ExHiROM') {
            if (bank < 0x40 && a < 0x8000) return -1;
            off = ((bank & 0x3F) << 16) | a;
            if (!(bank & 0x80)) off += 0x400000;
        } else {
            if ((bank & 0x7F) < 0x40 && a < 0x8000) return -1;
            off = ((bank & 0x3F) << 16) | a;
        }
        return off < size ? off : -1;
    }

    return { type, size, segment, header, canonical, busToRom };
}

const hex = (v, w) => (v >>> 0).toString(16).toUpperCase().padStart(w, '0');

/** 1234 / 12.3k / 4.56M / 7.89G: a hit count in at most 5 characters. */
function countText(n) {
    if (n < 10000) return String(n);
    for (const [d, u] of [[1e9, 'G'], [1e6, 'M'], [1e3, 'k']]) if (n >= d) return (n / d).toPrecision(3) + u;
    return String(n);
}

/** "C0:8012" */
function busName(addr) { return hex(addr >>> 16, 2) + ':' + hex(addr & 0xFFFF, 4); }

module.exports = { createRomMap, hex, busName, countText };
