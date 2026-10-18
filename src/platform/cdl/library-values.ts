/**
 * platform/cdl/library-values.ts
 *
 * Library streams about the VALUES the program wrote (core cdl-values.c), kept out of library-ext.ts:
 *   io-values.bin    640 x 32 bytes  256-bit "values written" bitmap per I/O register the CPU wrote:
 *                    register i < 256 is $2100+i (PPU, the SPC ports $2140-$2143), i >= 256 is $4200+(i-256)
 *                    (CPU registers, DMA channels up to $437F)                                      OR
 *   sram-flags.bin   128 KB          per SRAM byte, the WF bits of wram.flags (read / write / byte / word)   OR
 *   word-ranges.bin  2 x 128 K x 40  per WRAM address a 16-bit store hit, two sets (0 natural, 1 while a cheat or
 *                    tool had written memory lately): u16 min, u16 max, u8 n (0 none, 1..16 list length, 17 more
 *                    than 16 distinct), u16 values[16] sorted. Merge: min / max / union, >16 -> 17.
 *                    Commutative, associative, idempotent, so libraries from any sessions merge to the same result.
 * Size is bounded (about 10.7 MB), whatever the length of the play.
 */

const IO_REGS = 640;
const IO_BYTES = 32;
const SRAM_SIZE = 0x20000;
const RANGE_ADDRS = 0x20000;
const REC = 40;
const OVER = 17;
const SET_SIZE = RANGE_ADDRS * REC;
const RANGE_CHUNK = 256;   // addresses per drained chunk

const FILES = ['io-values.bin', 'sram-flags.bin', 'word-ranges.bin'];

/** The library's value streams (fields of the CDL library object, library.js). */
interface ValuesLib { ioVals: Uint8Array; sramFlags: Uint8Array; wordRanges: [Uint8Array, Uint8Array] }
/** A delta's chunks of the value streams. */
interface ValuesDelta {
    ioVals?: { index: number; data: Uint8Array }[];
    sramFlags?: { index: number; data: Uint8Array }[];
    wordRanges?: { set: number; index: number; data: Uint8Array }[];
}

function initValues(lib: Partial<ValuesLib>): void {
    lib.ioVals = new Uint8Array(IO_REGS * IO_BYTES);
    lib.sramFlags = new Uint8Array(SRAM_SIZE);
    lib.wordRanges = [new Uint8Array(SET_SIZE), new Uint8Array(SET_SIZE)];
}

import { fileU16 as u16 } from '../snes/hirom';

/** Merge one 40-byte record src[s..] into dst[d..]; true when dst changed. */
function mergeRecord(dst: Uint8Array, d: number, src: Uint8Array, s: number): boolean {
    const ns = src[s + 4];
    if (!ns) return false;
    const nd = dst[d + 4];
    if (!nd) { dst.set(src.subarray(s, s + REC), d); return true; }
    const out = new Uint8Array(REC);
    const mn = Math.min(u16(dst, d), u16(src, s)), mx = Math.max(u16(dst, d + 2), u16(src, s + 2));
    out[0] = mn & 255; out[1] = mn >> 8; out[2] = mx & 255; out[3] = mx >> 8;
    if (nd === OVER || ns === OVER) out[4] = OVER;
    else {
        const set = new Set<number>();
        for (let i = 0; i < nd; i++) set.add(u16(dst, d + 6 + i * 2));
        for (let i = 0; i < ns; i++) set.add(u16(src, s + 6 + i * 2));
        if (set.size > 16) out[4] = OVER;
        else {
            const vals = [...set].sort((a, b) => a - b);
            out[4] = vals.length;
            vals.forEach((v, i) => { out[6 + i * 2] = v & 255; out[7 + i * 2] = v >> 8; });
        }
    }
    for (let i = 0; i < REC; i++) if (out[i] !== dst[d + i]) { dst.set(out, d); return true; }
    return false;
}

function orBytes(dst: Uint8Array, base: number, data: Uint8Array, touch: (name: string) => void, name: string): void {
    for (let i = 0; i < data.length && base + i < dst.length; i++) {
        const v = dst[base + i] | data[i];
        if (v !== dst[base + i]) { dst[base + i] = v; touch(name); }
    }
}

/** Merge the values part of a delta: { ioVals:[{index,data}], sramFlags:[{index,data}], wordRanges:[{set,index,data}] }. */
function mergeValues(lib: ValuesLib, d: ValuesDelta, touch: (name: string) => void): void {
    for (const c of d.ioVals || []) orBytes(lib.ioVals, 0, c.data, touch, 'io-values.bin');
    for (const c of d.sramFlags || []) orBytes(lib.sramFlags, c.index * 4096, c.data, touch, 'sram-flags.bin');
    for (const c of d.wordRanges || []) {
        const set = lib.wordRanges[c.set & 1];
        const first = c.index * RANGE_CHUNK;
        for (let i = 0; i * REC < c.data.length && first + i < RANGE_ADDRS; i++) {
            if (mergeRecord(set, (first + i) * REC, c.data, i * REC)) touch('word-ranges.bin');
        }
    }
}

/** readBytes(name) -> Uint8Array | null. */
function loadValues(lib: ValuesLib, readBytes: (name: string) => Uint8Array | null): void {
    const io = readBytes('io-values.bin'), sr = readBytes('sram-flags.bin'), wr = readBytes('word-ranges.bin');
    if (io) lib.ioVals.set(io.subarray(0, lib.ioVals.length));
    if (sr) lib.sramFlags.set(sr.subarray(0, SRAM_SIZE));
    if (wr) for (let s = 0; s < 2; s++) lib.wordRanges[s].set(wr.subarray(s * SET_SIZE, (s + 1) * SET_SIZE));
}

function valueWriters(lib: ValuesLib): Record<string, () => Uint8Array> {
    return {
        'io-values.bin': () => lib.ioVals,
        'sram-flags.bin': () => lib.sramFlags,
        'word-ranges.bin': () => { const all = new Uint8Array(2 * SET_SIZE); all.set(lib.wordRanges[0]); all.set(lib.wordRanges[1], SET_SIZE); return all; },
    };
}

/** Values written to I/O register reg ($2100-$21FF, $4200-$437F) as a sorted list; null when never written. */
function ioValuesWritten(lib: ValuesLib, reg: number): number[] | null {
    const i = reg >= 0x2100 && reg <= 0x21FF ? reg - 0x2100 : reg >= 0x4200 && reg <= 0x437F ? 256 + reg - 0x4200 : -1;
    if (i < 0) return null;
    const out: number[] = [];
    for (let v = 0; v < 256; v++) if (lib.ioVals[i * IO_BYTES + (v >> 3)] & (1 << (v & 7))) out.push(v);
    return out.length ? out : null;
}

/** Range of the 16-bit stores at a WRAM address: { min, max, values: number[] | null (more than 16) } | null. */
function wordRange(lib: ValuesLib, addr: number, set = 0): { min: number; max: number; values: number[] | null } | null {
    const a = lib.wordRanges[set], o = addr * REC;
    const n = a[o + 4];
    if (!n) return null;
    const values: number[] = [];
    if (n !== OVER) for (let i = 0; i < n; i++) values.push(u16(a, o + 6 + i * 2));
    return { min: u16(a, o), max: u16(a, o + 2), values: n === OVER ? null : values };
}

export type { ValuesLib, ValuesDelta };
export { initValues, mergeValues, loadValues, valueWriters, mergeRecord, ioValuesWritten, wordRange, FILES, REC, RANGE_CHUNK, OVER };
