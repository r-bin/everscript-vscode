// Ownership: CHR tile graphics: the 16x16 graphic codec ($8CC88C) and 4bpp planar pixels.
// Pure. Decoder ported from everscript/tools/render_map.py ($8CC88C / $8CC9C0), with the bit-6 form read from
// $8CC8B0 and checked in VRAM; encoder our own, reproducing every vanilla graphic but the six in bit-6 form.
// See docs/map-format/map_tile_graphics_decompression.md.

import { getMapTileGraphicsOffset } from '../variant-resolver';
import { romFileOffset } from './rom';

/** US ROM file offset of the master 16x16 graphic pointer table (SNES $EE0000). */
export const GRAPHIC_TABLE = 0x2e0000;

/** A decompressed metatile: 4 sub-tiles of 8x8 in 4bpp = 128 bytes. */
const TILE_BYTES = 128;
const WORDS = TILE_BYTES / 2, HALF = WORDS / 2;

/** File offset of graphic `tileId`'s encoded bytes, through the master pointer table. */
export function tileGraphicOffset(rom: Uint8Array, tileId: number): number {
    const ptrAddr = getMapTileGraphicsOffset(rom) + tileId * 3;
    return romFileOffset(rom, rom[ptrAddr] | (rom[ptrAddr + 1] << 8) | (rom[ptrAddr + 2] << 16));
}

/** Decompress one 16x16 metatile graphic from the master $EE0000 table. */
export function decompressTile16x16(rom: Uint8Array, tileId: number): Uint8Array {
    return decodeTile(rom, tileGraphicOffset(rom, tileId)).bytes;
}

/**
 * Decode the graphic encoded at `buf[at]`, as the game does. `end` is one past the furthest byte read, which for
 * two vanilla graphics lies past their own bytes (the bit-6 run form below).
 *
 * The first byte selects the form:
 *   - bit 7 set: dual stream, a nibble command stream interleaved with literals ($8CC9C0)
 *   - bit 7 and 6 clear: `(b & 0x3F) + 1` literal words; the last repeats to fill ($8CC8B0)
 *   - bit 6 set: a prefix, then `(b & 0x3F) + 1` literal words; the last repeats. The prefix byte `p`: bit 7 set,
 *     `p & 0x3F` copies of the word that follows it; clear, `p` zero words. The routine then fetches the literals
 *     at +7 in the run form (it advances its pointer by 3 and its offset by 3), not at +4 where they are stored.
 *     A literal run that crosses word 32 is fetched in two parts, the first from +1 (zero form) or +4 (run form).
 */
export function decodeTile(buf: Uint8Array, at: number): { bytes: Uint8Array; end: number } {
    const info = buf[at];
    if (info & 0x80) return decodeDualStream(buf, at);
    const words: number[] = [];
    let end = at + 1;
    const word = (p: number) => { end = Math.max(end, p + 2); return buf[p] | (buf[p + 1] << 8); };
    let base = at, consumed = 0, count = (info & 0x3f) + 1;
    if (info & 0x40) {
        const prefix = buf[at + 1];
        end = at + 2;
        if (prefix & 0x80) {
            const w = word(at + 2);
            for (let i = 0; i < (prefix & 0x3f); i++) words.push(w);
            base = at + 3; consumed = 3;
        } else {
            for (let i = 0; i < prefix; i++) words.push(0);
            consumed = 1;
        }
    }
    const total = words.length + count;
    if (total > HALF && words.length < HALF) {
        const first = HALF - words.length;
        for (let i = 0; i < first; i++) words.push(word(base + 1 + i * 2));
        consumed += first * 2;
        count -= first;
    }
    for (let i = 0; i < count; i++) words.push(word(base + consumed + 1 + i * 2));
    consumed += count * 2;
    const last = word(base + consumed - 1);
    while (words.length < WORDS) words.push(last);
    const bytes = new Uint8Array(TILE_BYTES);
    for (let i = 0; i < WORDS; i++) { bytes[i * 2] = words[i] & 0xff; bytes[i * 2 + 1] = (words[i] >> 8) & 0xff; }
    return { bytes, end };
}

/** The dual-stream form: commands are nibbles from one pointer, literal bytes come from another that starts
 *  `info & 0x7F` bytes into the record. */
function decodeDualStream(buf: Uint8Array, at: number): { bytes: Uint8Array; end: number } {
    const out = new Uint8Array(TILE_BYTES);
    let dataPtr = at + (buf[at] & 0x7f);
    let cmdPtr = at + 1;
    let cmdSecondHalf = false;
    let outPos = 0;

    const read4 = (): number => {
        const val = buf[cmdPtr];
        let res: number;
        if (cmdSecondHalf) {
            res = val & 0x0f;
            cmdPtr += 1;
        } else {
            res = (val >> 4) & 0x0f;
        }
        cmdSecondHalf = !cmdSecondHalf;
        return res;
    };

    const put = (a: number, b: number): void => {
        out[outPos] = a;
        out[outPos + 1] = b;
        outPos += 2;
    };

    while (outPos < TILE_BYTES) {
        let indicators = buf[dataPtr];
        dataPtr += 1;

        for (let bit = 0; bit < 8; bit++) {
            if (!(indicators & 0x80)) {
                // Literal word straight from the data stream.
                put(buf[dataPtr], buf[dataPtr + 1]);
                dataPtr += 2;
            } else {
                const mode = read4();
                if (mode === 0) put(0x00, 0x00);
                else if (mode === 1) put(0xff, 0x00);
                else if (mode === 2) put(0x00, 0xff);
                else if (mode === 3) put(0xff, 0xff);
                else if (mode === 4) put(buf[dataPtr++], 0x00);
                else if (mode === 5) put(buf[dataPtr++], 0xff);
                else if (mode === 6) put(0x00, buf[dataPtr++]);
                else if (mode === 7) put(0xff, buf[dataPtr++]);
                else if (mode === 8) {
                    const v = buf[dataPtr++];
                    put(v, v);
                } else if (mode >= 9 && mode <= 12) {
                    // Repeat the previous word; mode 12 reads an extra nibble count.
                    const count = mode - 9 + 1 + (mode === 12 ? read4() : 0);
                    for (let i = 0; i < count; i++) {
                        if (outPos < 2) put(0x00, 0x00);
                        else put(out[outPos - 2], out[outPos - 1]);
                        if (outPos >= TILE_BYTES) break;
                    }
                } else if (mode === 13) {
                    put(outPos >= 2 ? out[outPos - 2] : 0, buf[dataPtr++]);
                } else if (mode === 14) {
                    const lo = buf[dataPtr++];
                    put(lo, outPos >= 2 ? out[outPos - 1] : 0);
                } else if (mode === 15) {
                    const v = buf[dataPtr++];
                    put(v, v ^ 0xff);
                }
            }

            if (outPos >= TILE_BYTES) break;
            indicators = (indicators << 1) & 0xff;
        }
    }

    return { bytes: out, end: Math.max(dataPtr, cmdPtr + (cmdSecondHalf ? 1 : 0)) };
}

/**
 * Encode 128 graphic bytes the way the vanilla graphics are encoded (all of them but the six in bit-6 form):
 * `full` (a graphic an animation channel streams: `$90A1B4` DMAs 128 bytes from +1) gives all 64 words raw;
 * otherwise the dual stream when it is strictly shorter, else the literal form with trailing repeats cut. The dual
 * stream is greedy: a repeat run of the previous word first (never across word 32, at most 19), then the first of
 * modes 0-8, 15, 14, 13 that fits, else a literal.
 */
export function encodeTile(bytes: Uint8Array, full = false): Uint8Array {
    const w: number[] = [];
    for (let i = 0; i < TILE_BYTES; i += 2) w.push(bytes[i] | (bytes[i + 1] << 8));
    let n = WORDS;
    if (!full) while (n > 1 && w[n - 2] === w[n - 1]) n--;
    const literal = Uint8Array.from([n - 1, ...bytes.subarray(0, n * 2)]);
    if (full) return literal;
    const packed = encodeDualStream(w);
    return packed && packed.length < literal.length ? packed : literal;
}

function encodeDualStream(w: number[]): Uint8Array | null {
    type Cmd = { nibbles: number[]; data: number[] } | { literal: [number, number] };
    const cmds: Cmd[] = [];
    let prev = 0;
    for (let i = 0; i < WORDS;) {
        const limit = i < HALF ? HALF : WORDS;
        let run = 0;
        while (i + run < limit && w[i + run] === prev && run < 19) run++;
        if (run > 0) {
            cmds.push({ nibbles: run <= 3 ? [8 + run] : [12, run - 4], data: [] });
            i += run;
            continue;
        }
        const v = w[i], lo = v & 0xff, hi = v >> 8;
        const fits: [number, boolean, number[]][] = [
            [0, v === 0, []], [1, v === 0x00ff, []], [2, v === 0xff00, []], [3, v === 0xffff, []],
            [4, hi === 0, [lo]], [5, hi === 0xff, [lo]], [6, lo === 0, [hi]], [7, lo === 0xff, [hi]], [8, lo === hi, [lo]],
            [15, hi === (lo ^ 0xff), [lo]], [14, hi === prev >> 8, [lo]], [13, lo === (prev & 0xff), [hi]],
        ];
        const m = fits.find(f => f[1]);
        cmds.push(m ? { nibbles: [m[0]], data: m[2] } : { literal: [lo, hi] });
        prev = v;
        i++;
    }
    const nibbles: number[] = [], data: number[] = [];
    for (let k = 0; k < cmds.length; k += 8) {
        const group = cmds.slice(k, k + 8);
        data.push(group.reduce((b, c, j) => 'literal' in c ? b : b | (0x80 >> j), 0));
        for (const c of group) {
            if ('literal' in c) data.push(...c.literal);
            else { data.push(...c.data); nibbles.push(...c.nibbles); }
        }
    }
    const cmdBytes: number[] = [];
    for (let k = 0; k < nibbles.length; k += 2) cmdBytes.push((nibbles[k] << 4) | (nibbles[k + 1] ?? 0));
    const offset = 1 + cmdBytes.length;
    return offset > 0x7f ? null : Uint8Array.from([0x80 | offset, ...cmdBytes, ...data]);
}

/** 256 palette indices (row-major) → 128 bytes of 4bpp planar: the inverse of `decodeTilePixels` unflipped. */
export function encodeTilePixels(pixels: ArrayLike<number>): Uint8Array {
    const out = new Uint8Array(TILE_BYTES);
    for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
            const p = pixels[py * 16 + px];
            const base = ((px >> 3) + (py >> 3) * 2) * 32 + (py & 7) * 2, mask = 0x80 >> (px & 7);
            if (p & 1) out[base] |= mask;
            if (p & 2) out[base + 1] |= mask;
            if (p & 4) out[base + 16] |= mask;
            if (p & 8) out[base + 17] |= mask;
        }
    }
    return out;
}

/**
/**
 * Convert a 128-byte 4bpp planar metatile into 256 palette indices (0..15),
 * row-major, applying 16x16 hardware flip mirroring.
 */
export function decodeTilePixels(tileBytes: Uint8Array, hflip = false, vflip = false): Uint8Array {
    const pixels = new Uint8Array(256);

    // 4 sub-tiles: index = subX + subY * 2, each 32 bytes of two bitplane pairs.
    for (let subY = 0; subY < 2; subY++) {
        for (let subX = 0; subX < 2; subX++) {
            const base = (subX + subY * 2) * 32;
            for (let row = 0; row < 8; row++) {
                const b0 = tileBytes[base + row * 2];
                const b1 = tileBytes[base + row * 2 + 1];
                const b2 = tileBytes[base + row * 2 + 16];
                const b3 = tileBytes[base + row * 2 + 17];
                for (let col = 0; col < 8; col++) {
                    const mask = 1 << (7 - col);
                    const p =
                        (b0 & mask ? 1 : 0) |
                        ((b1 & mask ? 1 : 0) << 1) |
                        ((b2 & mask ? 1 : 0) << 2) |
                        ((b3 & mask ? 1 : 0) << 3);
                    const px = subX * 8 + col;
                    const py = subY * 8 + row;
                    const outX = hflip ? 15 - px : px;
                    const outY = vflip ? 15 - py : py;
                    pixels[outY * 16 + outX] = p;
                }
            }
        }
    }

    return pixels;
}

const _colorMaskCache = new WeakMap<Uint8Array, Map<number, number>>();

/**
 * 16-bit bitmask of which palette colour indices (1..15) appear in a 16x16 graphic.
 */
export function tileColorMask(rom: Uint8Array, tileId: number): number {
    let byTile = _colorMaskCache.get(rom);
    if (!byTile) {
        byTile = new Map<number, number>();
        _colorMaskCache.set(rom, byTile);
    }
    const hit = byTile.get(tileId);
    if (hit !== undefined) return hit;
    const px = decodeTilePixels(decompressTile16x16(rom, tileId));
    let mask = 0;
    for (let i = 0; i < px.length; i++) {
        if (px[i] > 0) mask |= 1 << px[i];
    }
    byTile.set(tileId, mask);
    return mask;
}
