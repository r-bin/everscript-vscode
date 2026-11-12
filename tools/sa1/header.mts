// Block 0, the S-CPU's bank $00 (LoROM view $00:8000-FFFF = file 0x0000-0x7FFF): the cartridge header that makes
// emulators and flashcarts treat the image as SA-1, the CPU vector table, and the few bytes each vector runs in bank
// $00 before it jumps to $80 (knowledge/routines/CPU_VECTORS.md). Also the checksum, and a check that MesenCE picks
// this header and no other.
//
// Header fields changed from the original (all else, title included, is copied from the user's ROM):
//   $FFD5 map mode   $31 (HiROM, FastROM) → $23 (SA-1)
//   $FFD6 cart type  $02 (ROM + RAM + battery) → $35 (SA-1, ROM + RAM + battery); the RAM is BW-RAM now
//   $FFD7 ROM size   $0C (4 MB) → $0D (8 MB)
//   $FFDC-$FFDF      checksum complement and checksum over the whole 8 MB
// SRAM size ($FFD8 = $03, 8 KB) stays: it sizes the BW-RAM.
import { createRequire } from 'node:module';
import { LINEAR } from './layout.mts';

const require = createRequire(import.meta.url);
const { readVectors, bankZeroEntry, checksum } = require('../exhirom/convert.js');

export const SA1_MAP_MODE = 0x23, SA1_CART_TYPE = 0x35, SIZE_8MB = 0x0D;
const HEADER = 0xFFB0, HEADER_END = 0xFFE0, VECTORS = 0xFFE0;
const MAP_MODE = 0xFFD5, CART_TYPE = 0xFFD6, ROM_SIZE = 0xFFD7, COMPLEMENT = 0xFFDC;

/** File offset of a bank-$00 address ($00:8000+ = block 0 offset 0). */
export const bankZero = (addr: number) => addr - 0x8000;

export interface VectorEntry { start: number; length: number; exit: string; vectors: string[] }

/** Writes the vector entries, header and vector table into block 0; returns the entries it copied. */
export function writeBankZero(image: Uint8Array, rom: Uint8Array): VectorEntry[] {
    const entries = new Map<number, VectorEntry>();
    for (const v of readVectors(rom)) {
        if (!entries.has(v.target)) entries.set(v.target, { ...bankZeroEntry(rom, v.target, v.name === 'RESET'), vectors: [] });
        entries.get(v.target)!.vectors.push(v.name);
    }
    for (const e of entries.values()) image.set(rom.subarray(e.start, e.start + e.length), bankZero(e.start));
    const header = rom.slice(HEADER, HEADER_END);
    header[MAP_MODE - HEADER] = SA1_MAP_MODE;
    header[CART_TYPE - HEADER] = SA1_CART_TYPE;
    header[ROM_SIZE - HEADER] = SIZE_8MB;
    header.set([0xFF, 0xFF, 0x00, 0x00], COMPLEMENT - HEADER);   // placeholder until the checksum is known
    image.set(header, bankZero(HEADER));
    image.set(rom.subarray(VECTORS, VECTORS + 0x20), bankZero(VECTORS));
    // The linear copy keeps the original header at 0x40FFC0 as data. Without a valid checksum pair it can't outscore
    // block 0's (mesenHeaderScores).
    image.fill(0, LINEAR + COMPLEMENT, LINEAR + COMPLEMENT + 4);
    return [...entries.values()];
}

/** Ranges of block 0 that hold something: entries, header, vectors. */
export const bankZeroUsed = (entries: VectorEntry[]): [number, number][] => [
    ...entries.map(e => [bankZero(e.start), bankZero(e.start) + e.length] as [number, number]),
    [bankZero(HEADER), bankZero(VECTORS) + 0x20],
];

/** Writes the checksum pair into block 0's header; call last. */
export function finishChecksum(image: Uint8Array): number {
    const sum = checksum(image);
    image.set([~sum & 0xFF, (~sum >> 8) & 0xFF, sum & 0xFF, sum >> 8], bankZero(COMPLEMENT));
    return sum;
}

/**
 * MesenCE's header score (BaseCartridge::GetHeaderScore) at each base it tries; the highest wins, ties go to the
 * later base. Block 0 must win alone: the linear copy of the original header at 0x40FFC0 would make Mesen map the
 * cart as ExHiROM around the SA-1. Other emulators score differently (to verify, docs/sa1/port.md §6).
 */
export function mesenHeaderScores(img: Uint8Array): Record<string, number> {
    const out: Record<string, number> = {};
    for (const base of [0, 0x8000, 0x400000, 0x408000]) {
        const h = base + 0x7FB0;
        const mode = img[h + 0x25] & ~0x10;
        let score = 0;
        if ((mode === 0x20 || mode === 0x22) && (base & ~0x400000) < 0x8000) score++;
        else if ((mode === 0x21 || mode === 0x25) && (base & ~0x400000) >= 0x8000) score++;
        if (img[h + 0x26] < 0x08) score++;
        if (img[h + 0x27] < 0x10) score++;
        if (img[h + 0x28] < 0x08) score++;
        const cc = img[h + 0x2C] | (img[h + 0x2D] << 8), cs = img[h + 0x2E] | (img[h + 0x2F] << 8);
        if (cs + cc === 0xFFFF && cs !== 0 && cc !== 0) score += 8;
        const reset = img[base + 0x7FFC] | (img[base + 0x7FFD] << 8);
        if (reset < 0x8000) { out[base.toString(16).padStart(6, '0')] = -1; continue; }
        const op = img[base + (reset & 0x7FFF)];
        if ([0x18, 0x78, 0x4C, 0x5C, 0x20, 0x22, 0x9C].includes(op)) score += 8;
        else if ([0xC2, 0xE2, 0xA9, 0xA2, 0xA0].includes(op)) score += 4;
        else if ([0x00, 0xFF, 0xCC].includes(op)) score -= 8;
        out[base.toString(16).padStart(6, '0')] = Math.max(0, score);
    }
    return out;
}

/** Throws unless MesenCE would pick block 0's header. */
export function assertMesenPicksBlockZero(image: Uint8Array): Record<string, number> {
    const scores = mesenHeaderScores(image);
    const best = Math.max(...Object.values(scores));
    if (scores['000000'] !== best || Object.values(scores).filter(s => s === best).length > 1) {
        throw new Error(`MesenCE would not pick the SA-1 header at 0x7FC0: ${JSON.stringify(scores)}`);
    }
    return scores;
}
