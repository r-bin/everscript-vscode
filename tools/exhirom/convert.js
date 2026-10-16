#!/usr/bin/env node
// Convert a HiROM Secret of Evermore image into an 8 MB ExHiROM image (docs/exhirom/port.md).
//   npm run exhirom -- [clean rom] [out.sfc] [--fill ff|db] [--upper hardware|snes9x2005|fill]
//   (ROM: argument, else $SOE_ROM, else out/rom.sfc; output: out/soe-exhirom.sfc)
// The first 3 MB stay byte-identical except the 6 header bytes that say "ExHiROM, 8 MB" and the checksum pair;
// 0x300000-0x3FFFFF repeats what the original cartridge answers there (--upper, see UPPER_MODES); the new second
// half (file 0x400000+, bus $00-$3F:8000+ / $40-$7D) is empty except a copy of the header, the vector table and
// the few instructions each vector target runs in bank $00 before it jumps into bank $80.
// --fill db --upper fill fills every unused byte with STP ($DB): a "trap image" in which any stray jump stops the
// CPU and any stray read returns $DB, used by prove.js. The default fill is $FF.
'use strict';
const fs = require('fs');
const path = require('path');
const { OPCODES, instructionLength } = require('../../src/shared/opcodes-65816');

const REPO = path.resolve(__dirname, '..', '..');
const DEFAULT_OUT = path.join(REPO, 'out', 'soe-exhirom.sfc');

const MB = 0x100000;
const OUT_SIZE = 8 * MB;
const HALF = 4 * MB;
const HEADER = 0xFFB0;            // extended header (maker, game code) + standard header: $FFB0-$FFDF
const HEADER_END = 0xFFE0;
const VECTORS = 0xFFE0;           // 16 words, $FFE0-$FFFF
const MAP_MODE = 0xFFD5, ROM_SIZE = 0xFFD7, COMPLEMENT = 0xFFDC, CHECKSUM = 0xFFDE;
const EXHIROM_FAST = 0x35, SIZE_8MB = 0x0D;
const VECTOR_NAMES = ['', '', 'COP', 'BRK', 'ABORT', 'NMI', '', 'IRQ', '', '', 'COP (emu)', '', 'ABORT (emu)', 'NMI (emu)', 'RESET', 'IRQ/BRK (emu)'];
// ABORT has no pin on the SNES and the game never runs in emulation mode after reset except the reset itself.
const NEVER_TAKEN = new Set(['ABORT', 'ABORT (emu)', 'COP (emu)']);

const word = (b, o) => b[o] | (b[o + 1] << 8);
const hex = (v, n) => v.toString(16).toUpperCase().padStart(n, '0');

function stripCopierHeader(buf) {
    return buf.length % 1024 === 512 ? buf.subarray(512) : buf;
}

/** The vectors the CPU can take, with their bank-$00 targets. */
function readVectors(rom) {
    const out = [];
    for (let i = 0; i < 16; i++) {
        const name = VECTOR_NAMES[i];
        if (!name || NEVER_TAKEN.has(name)) continue;
        out.push({ name, slot: VECTORS + 2 * i, target: word(rom, VECTORS + 2 * i) });
    }
    return out;
}

/**
 * Walk the straight-line code a vector runs in bank $00 (HiROM: $00:8000-$FFFF = file 0x8000-0xFFFF) until it
 * leaves the bank with a JML into $80+ or stops (STP). Anything else (a branch, a call, a data read through
 * bank $00) is refused: that needs a hand-written stub, not a copy.
 * @returns {{ start, length, exit: string }}
 */
function bankZeroEntry(rom, target, atReset = false) {
    if (target < 0x8000) throw new Error(`vector target $00:${hex(target, 4)} is not ROM`);
    // Reset starts in emulation mode (8-bit A/X/Y); an interrupt keeps whatever widths the interrupted code had,
    // so there an immediate's length is only known after the stub's own REP/SEP.
    let pc = target, m8 = true, x8 = true, mKnown = atReset, xKnown = atReset;
    for (let n = 0; n < 16; n++) {
        const op = rom[pc];
        const { mnemonic, mode } = OPCODES[op];
        if ((mode === 'immM' && !mKnown) || (mode === 'immX' && !xKnown)) {
            throw new Error(`$00:${hex(target, 4)}: ${mnemonic} # at $00:${hex(pc, 4)} has an unknown width; needs a hand-written stub`);
        }
        const len = instructionLength(op, m8, x8);
        if (mnemonic === 'STP') return { start: target, length: pc + 1 - target, exit: 'STP' };
        if (mnemonic === 'JML' && mode === 'long') {
            const dest = rom[pc + 1] | (rom[pc + 2] << 8) | (rom[pc + 3] << 16);
            if (dest < 0x800000) throw new Error(`$00:${hex(target, 4)} jumps to $${hex(dest, 6)}, which moves under ExHiROM`);
            return { start: target, length: pc + len - target, exit: `JML $${hex(dest >> 16, 2)}:${hex(dest & 0xFFFF, 4)}` };
        }
        if (mnemonic === 'REP' || mnemonic === 'SEP') {
            const v = mnemonic === 'SEP';
            if (rom[pc + 1] & 0x20) { m8 = v; mKnown = true; }
            if (rom[pc + 1] & 0x10) { x8 = v; xKnown = true; }
        } else if (!sameInEveryBank(rom, pc, mnemonic, mode)) {
            throw new Error(`$00:${hex(target, 4)}: ${mnemonic} at $00:${hex(pc, 4)} needs a hand-written stub`);
        }
        pc += len;
    }
    throw new Error(`$00:${hex(target, 4)} does not leave bank $00 within 16 instructions`);
}

// Register-only ops and immediates behave the same whichever bank they run from; so does a store through
// DB:abs while it hits low WRAM ($0000-$1FFF) or I/O ($2100-$43FF), which every bank $00-$3F maps alike.
// Everything that reads memory, pushes/pulls the bank or transfers control (other than the exit JML) is refused.
const BANK_OPS = new Set(['PHK', 'PHB', 'PLB', 'RTS', 'RTL', 'RTI', 'BRK', 'COP', 'WDM']);
function sameInEveryBank(rom, pc, mnemonic, mode) {
    if (mode === 'imp') return !BANK_OPS.has(mnemonic);
    if (mode === 'immM' || mode === 'immX') return true;
    if (mode === 'abs' && /^ST[AXYZ]$/.test(mnemonic)) {
        const a = word(rom, pc + 1);
        return a < 0x2000 || (a >= 0x2100 && a < 0x4400);
    }
    return false;
}

/**
 * File offset an original cartridge of `size` bytes answers for `addr` >= size: the chips are power-of-two sized
 * and each one mirrors inside its own window (3 MB = 2 MB + 1 MB, so 0x300000+ shows 0x200000+). bsnes models it
 * this way; Mesen2 and the bundled snes9x2005 do not (snes-memory-mapping skill §6).
 */
function hardwareMirror(addr, size) {
    let base = 0, mask = 1 << 23;
    while (addr >= size) {
        while (!(addr & mask)) mask >>= 1;
        addr -= mask;
        if (size > mask) { size -= mask; base += mask; }
        mask >>= 1;
    }
    return base + addr;
}

// What the area between the end of the original and 4 MB holds. Under HiROM it was never ROM of its own: the game
// reads it once anyway ($80:D113 reads $B0:E653+, knowledge/rom/80d113.md), so it must keep answering like before.
//   hardware    a copy of what the original cartridge answers there (default; Mesen2 / bsnes / real hardware)
//   snes9x2005  a copy of what the bundled snes9x2005 core answers (offset % size) — only for prove.js
//   fill        the fill byte (trap image)
const UPPER_MODES = {
    hardware: (rom, off) => rom[hardwareMirror(off, rom.length)],
    snes9x2005: (rom, off) => rom[off % rom.length],
};

function checksum(img) {
    let sum = 0;
    for (let i = 0; i < img.length; i++) sum += img[i];
    return sum & 0xFFFF;
}

/**
 * @param {Uint8Array} source unheadered HiROM image (FastROM HiROM, at most 4 MB)
 * @param {{ fill?: number, upper?: 'hardware'|'snes9x2005'|'fill' }} [opts]
 * @returns {{ image: Uint8Array, report: object }}
 */
function convert(source, opts = {}) {
    const rom = stripCopierHeader(source);
    const fill = opts.fill === undefined ? 0xFF : opts.fill;
    const upper = opts.upper || 'hardware';
    if (rom.length > HALF || rom.length < 0x10000) throw new Error(`expected a HiROM image of 64 KB-4 MB, got ${rom.length} bytes`);
    if ((rom[MAP_MODE] & ~0x10) !== 0x21) throw new Error(`map mode $${hex(rom[MAP_MODE], 2)} at $FFD5 is not HiROM`);
    if (upper !== 'fill' && !UPPER_MODES[upper]) throw new Error(`unknown upper mode ${upper}`);

    const image = new Uint8Array(OUT_SIZE).fill(fill);
    image.set(rom, 0);
    if (upper !== 'fill') for (let off = rom.length; off < HALF; off++) image[off] = UPPER_MODES[upper](rom, off);

    const vectors = readVectors(rom);
    const entries = new Map();
    for (const v of vectors) {
        if (!entries.has(v.target)) {
            const onlyReset = vectors.every(w => w.target !== v.target || w.name === 'RESET');
            entries.set(v.target, { ...bankZeroEntry(rom, v.target, onlyReset), vectors: [] });
        }
        entries.get(v.target).vectors.push(v.name);
    }
    for (const e of entries.values()) image.set(rom.subarray(e.start, e.start + e.length), HALF + e.start);

    // Header (both copies say ExHiROM so every header-scoring emulator picks the same mapping) and vectors.
    const header = rom.slice(HEADER, HEADER_END);
    header[MAP_MODE - HEADER] = EXHIROM_FAST;
    header[ROM_SIZE - HEADER] = SIZE_8MB;
    for (const base of [0, HALF]) {
        image.set(header, base + HEADER);
        image.set([0xFF, 0xFF, 0x00, 0x00], base + COMPLEMENT);
    }
    image.set(rom.subarray(VECTORS, VECTORS + 0x20), HALF + VECTORS);
    const sum = checksum(image);
    for (const base of [0, HALF]) {
        image.set([~sum & 0xFF, (~sum >> 8) & 0xFF, sum & 0xFF, sum >> 8], base + COMPLEMENT);
    }

    const changed = [];
    for (let i = 0; i < rom.length; i++) if (image[i] !== rom[i]) changed.push(i);
    return {
        image,
        report: {
            sourceSize: rom.length, size: OUT_SIZE, fill, upper, checksum: sum,
            mapMode: { from: rom[MAP_MODE], to: EXHIROM_FAST }, romSize: { from: rom[ROM_SIZE], to: SIZE_8MB },
            changedInSource: changed,
            entries: [...entries.values()].map(e => ({ ...e, file: HALF + e.start })),
        },
    };
}

/** Byte ranges of the second half that convert() writes (everything else there is fill). */
function secondHalfUsed(report) {
    return [
        ...report.entries.map(e => [e.file, e.file + e.length]),
        [HALF + HEADER, HALF + HEADER_END],
        [HALF + VECTORS, HALF + VECTORS + 0x20],
    ];
}

function main() {
    const args = process.argv.slice(2);
    const fi = args.indexOf('--fill');
    const fill = fi < 0 ? 0xFF : parseInt(args.splice(fi, 2)[1], 16);
    const ui = args.indexOf('--upper');
    const upper = ui < 0 ? 'hardware' : args.splice(ui, 2)[1];
    const src = args[0] || process.env.SOE_ROM || path.join(REPO, 'out', 'rom.sfc');
    const out = args[1] || DEFAULT_OUT;
    if (!fs.existsSync(src)) {
        console.error(`ROM not found: ${src}\nusage: convert.js [clean rom] [out.sfc] [--fill ff|db] [--upper hardware|snes9x2005|fill]\n(ROM defaults to $SOE_ROM, then out/rom.sfc; output to out/soe-exhirom.sfc)`);
        process.exit(2);
    }
    const { image, report } = convert(new Uint8Array(fs.readFileSync(src)), { fill, upper });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, image);
    console.log(`wrote ${out}: ${report.size / MB} MB ExHiROM, map mode $${hex(report.mapMode.to, 2)}, size $${hex(report.romSize.to, 2)}, checksum $${hex(report.checksum, 4)}, fill $${hex(fill, 2)}, 0x${hex(report.sourceSize, 6)}-0x3FFFFF: ${upper}`);
    console.log(`bytes changed inside the original ${report.sourceSize / MB} MB: ${report.changedInSource.map(o => '0x' + hex(o, 6)).join(' ')}`);
    for (const e of report.entries) {
        console.log(`  bank-$00 entry $00:${hex(e.start, 4)} (${e.vectors.join(', ')}): ${e.length} bytes copied to file 0x${hex(e.file, 6)}, then ${e.exit}`);
    }
}

if (require.main === module) main();
module.exports = { convert, secondHalfUsed, bankZeroEntry, hardwareMirror, UPPER_MODES, OUT_SIZE, HALF };
