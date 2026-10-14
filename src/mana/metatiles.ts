// Ownership: the 16x16 metatile tables, decoded as $02:A000 / $02:A069 do.
//
// $CB:4000 + set*3 is a 24-bit pointer to a bit stream (read MSB first) of
// 384 metatiles x 4 BG tilemap words (top-left, top-right, bottom-left,
// bottom-right). One running word is kept; each output word is:
//   00              the running word again
//   01 / 10         its low byte +1 / -1 (wrapping inside the low byte)
//   11 00 nnnnnn    word + n            11 01 nnnnnn   word - (64 - n)
//   11 10 a nnn s   a=0: palette bits (10-12) = nnn; a=1: bits 15,14,13
//                   (v-flip, h-flip, priority) = nnn; then word += signed 6-bit s
//   11 11 + 16 bits the word itself
// The first 192 metatiles are half 0, the rest half 1. Header byte 2 bit 6
// picks the half for layer A's table ($7F:C000), bit 7 for layer B's ($7F:C800).

import { Rom, u24 } from './rom';

const STREAM_POINTERS = 0xCB4000;
export const METATILES_PER_HALF = 192;
const WORDS = 384 * 4;

/** All 384 metatiles of set `set`, 4 words each (1536 words). */
export function decodeMetatileSet(rom: Rom, set: number): Uint16Array {
    let p = u24(rom, STREAM_POINTERS + (set & 0x3F) * 3) & 0x3FFFFF;
    let byte = 0, left = 0;
    const bits = (n: number): number => {
        let v = 0;
        for (let i = 0; i < n; i++) {
            if (left === 0) { byte = rom[p++] ?? 0; left = 8; }
            v = (v << 1) | ((byte >> 7) & 1);
            byte = (byte << 1) & 0xFF;
            left--;
        }
        return v;
    };
    const out = new Uint16Array(WORDS);
    let w = 0;
    for (let i = 0; i < WORDS; i++) {
        const op = bits(2);
        if (op === 1) w = (w & 0xFF00) | ((w + 1) & 0xFF);
        else if (op === 2) w = (w & 0xFF00) | ((w - 1) & 0xFF);
        else if (op === 3) {
            const sub = bits(2);
            if (sub === 0) w = (w + bits(6)) & 0xFFFF;
            else if (sub === 1) w = (w - (64 - bits(6))) & 0xFFFF;
            else if (sub === 2) {
                const a = bits(4);
                if (a & 8) w = (w & 0x1FFF) | ((a & 7) << 13);
                else w = (w & 0xE3FF) | ((a & 7) << 10);
                const s = bits(6);
                w = (w + (s & 0x20 ? s - 64 : s)) & 0xFFFF;
            } else w = bits(16);
        }
        out[i] = w;
    }
    return out;
}

/** The 192 metatiles (768 words) of one half. */
export function metatileHalf(set: Uint16Array, half: 0 | 1): Uint16Array {
    return set.subarray(half * METATILES_PER_HALF * 4, (half + 1) * METATILES_PER_HALF * 4);
}
