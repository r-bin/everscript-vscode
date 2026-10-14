// Ownership: decompressing one map piece into the layer buffers, as $00:CD93 does.
//
// The game decodes straight into bank $7F, where layer A starts at $0000 and
// layer B at $4000, one row every $80 bytes. Back-references read whatever is
// already there (cells left of, or rows above, the piece), so this works on the
// same 64 KB buffer instead of a piece-sized array.
//
// Piece header (pointer = word $CD:0004 + index*2; bank $CD below index word
// $CD:0000, $CE below $CD:0002, $CF below $CD:0004, else $CC):
//   byte 0: width-1 << 1 | s0     byte 1: height-1 << 1 | s1
//   s0|s1 set: a stamp table follows ($00:CD0B): entries of [size byte
//   (w-1 | h-1 << 4), data...] each ended by a byte >= $F8; $FF ends the table.
// Stream opcodes (the cursor walks the piece row by row):
//   00-BF  literal cell
//   C0-DF  (n = b&7 + 1) cells copying the value d = (b>>3 & 3) + 1 cells back
//   E0 m   (m&$7F)+1 cells copied from 1 row above (m < $80) or 2 rows above
//   E1-E7  (b&7)+1 cells copied from the row above
//   E8-EF m  (m&$7F)+1 cells copied from d = (b&7)*2 + (m>>7) + 1 cells back (overlap repeats)
//   F0 m   (m&$7F)+1 cells, each the previous cell +1 (m < $80) or -1
//   F1-F7  (b&7)+1 cells, each the previous cell +1
//   F8-FF  stamp b&7 goes here; the cursor skips one cell. Stamps are drawn
//          after the stream, in order, with the same opcodes ($00:CD4B).
// A stream ends when its last row is filled, mid-opcode if need be.

import { Rom, u8, u16 } from './rom';

const PIECE_BANK_LIMITS = 0xCD0000;   // three words: first index of $CE, $CF, $CC
const PIECE_POINTERS = 0xCD0004;
const MAX_MARKS = 56;                 // the mark list at $7F:FF20 has room for 56 4-byte entries

interface Stamp { w: number; h: number; data: number }

export interface PieceSize { w: number; h: number }

/** Bus address of a piece's header byte 0. */
export function pieceAddress(rom: Rom, index: number): number {
    let bank = 0xCD;
    if (index >= u16(rom, PIECE_BANK_LIMITS)) bank = 0xCE;
    if (index >= u16(rom, PIECE_BANK_LIMITS + 2)) bank = 0xCF;
    if (index >= u16(rom, PIECE_BANK_LIMITS + 4)) bank = 0xCC;
    return (bank << 16) | u16(rom, PIECE_POINTERS + index * 2);
}

export function pieceSize(rom: Rom, index: number): PieceSize {
    const at = pieceAddress(rom, index);
    return { w: (u8(rom, at) >> 1) + 1, h: (u8(rom, at + 1) >> 1) + 1 };
}

/**
 * Decode piece `index` into `mem` (bank $7F image) with its top-left cell at
 * `dest`. Returns the piece size.
 */
export function decodePiece(rom: Rom, index: number, mem: Uint8Array, dest: number): PieceSize {
    const at = pieceAddress(rom, index);
    const b0 = u8(rom, at), b1 = u8(rom, at + 1);
    const size = { w: (b0 >> 1) + 1, h: (b1 >> 1) + 1 };
    let p = at + 2;
    const stamps: Stamp[] = [];
    if ((b0 | b1) & 1) {
        for (;;) {
            const dims = u8(rom, p++);
            stamps.push({ w: (dims & 0x0F) + 1, h: (dims >> 4) + 1, data: p });
            let b;
            do { b = u8(rom, p++); } while (b < 0xF8);
            if (b === 0xFF) break;
        }
    }
    const marks: Array<{ stamp: number; at: number }> = [];
    runStream(rom, p, mem, dest, size.w, size.h, marks);
    for (let k = 0; k < marks.length; k++) {
        const s = stamps[marks[k].stamp];
        if (s) runStream(rom, s.data, mem, marks[k].at, s.w, s.h, marks);
    }
    return size;
}

function runStream(rom: Rom, src: number, mem: Uint8Array, dest: number, w: number, h: number,
    marks: Array<{ stamp: number; at: number }>): void {
    let row = dest, col = 0, rows = h;
    const next = () => u8(rom, src++);
    const read = (addr: number) => mem[addr & 0xFFFF];
    /** Write (or skip) the cursor cell and advance; true once the last row is done. */
    const put = (v: number | null): boolean => {
        if (v !== null) mem[(row + col) & 0xFFFF] = v & 0xFF;
        if (++col >= w) { col -= w; row += 0x80; rows--; }
        return rows === 0;
    };
    /** Address of the cell `d` back in reading order (at most one row back). */
    const back = (d: number): [number, number] => {
        let r = row, c = col - d;
        if (c < 0) { c += w; r -= 0x80; }
        return [r, c];
    };
    for (;;) {
        const b = next();
        if (b < 0xC0) {
            if (put(b)) return;
        } else if (b < 0xE0) {
            const [r, c] = back(((b >> 3) & 3) + 1);
            const v = read(r + c);
            for (let n = (b & 7) + 1; n > 0; n--) if (put(v)) return;
        } else if (b < 0xE8) {
            let up = 0x80, n = (b & 7) + 1;
            if (b === 0xE0) { const m = next(); up = m & 0x80 ? 0x100 : 0x80; n = (m & 0x7F) + 1; }
            for (; n > 0; n--) if (put(read(row + col - up))) return;
        } else if (b < 0xF0) {
            const m = next();
            let [r, c] = back(((b & 7) << 1 | m >> 7) + 1);
            for (let n = (m & 0x7F) + 1; n > 0; n--) {
                const v = read(r + c);
                if (++c >= w) { c -= w; r += 0x80; }
                if (put(v)) return;
            }
        } else if (b < 0xF8) {
            let step = 1, n = (b & 7) + 1;
            if (b === 0xF0) { const m = next(); step = m & 0x80 ? -1 : 1; n = (m & 0x7F) + 1; }
            const [r, c] = back(1);
            let v = read(r + c);
            for (; n > 0; n--) { v = (v + step) & 0xFF; if (put(v)) return; }
        } else {
            if (marks.length < MAX_MARKS) marks.push({ stamp: b & 7, at: (row + col) & 0xFFFF });
            if (put(null)) return;
        }
    }
}
