// Ownership: CHR tile graphics decompression and 4bpp planar pixel decoding.
// Pure. Ported from everscript/tools/render_map.py ($8CC88C / $8CC9C0).
// See docs/map-format/map_tile_graphics_decompression.md.

/** ROM file offset of the master 16x16 graphic pointer table (SNES $EE0000). */
const GRAPHIC_TABLE = 0x2e0000;

/** A decompressed metatile: 4 sub-tiles of 8x8 in 4bpp = 128 bytes. */
const TILE_BYTES = 128;

/**
 * Decompress one 16x16 metatile graphic from the master $EE0000 table.
 *
 * Two encodings, selected by bit 7 of the first byte:
 *   - clear: uncompressed word copy ($8CC8B0), last word repeated to fill
 *   - set:   dual-stream, a nibble command stream interleaved with literals
 *            ($8CC9C0)
 */
export function decompressTile16x16(rom: Uint8Array, tileId: number): Uint8Array {
    const ptrAddr = GRAPHIC_TABLE + tileId * 3;
    const dataAddr = (rom[ptrAddr] | (rom[ptrAddr + 1] << 8) | (rom[ptrAddr + 2] << 16)) & 0x3fffff;
    const tileInfo = rom[dataAddr];
    const out = new Uint8Array(TILE_BYTES);

    // Mode 1: uncompressed word copy, trailing words repeat the last one.
    if (!(tileInfo & 0x80)) {
        const wordCount = Math.min((tileInfo & 0x7f) + 1, 64);
        const src = dataAddr + 1;
        out.set(rom.subarray(src, src + wordCount * 2), 0);
        const lastLo = wordCount > 0 ? out[wordCount * 2 - 2] : 0;
        const lastHi = wordCount > 0 ? out[wordCount * 2 - 1] : 0;
        for (let i = wordCount * 2; i < TILE_BYTES; i += 2) {
            out[i] = lastLo;
            out[i + 1] = lastHi;
        }
        return out;
    }

    // Mode 2: dual-stream. Commands are nibbles from one pointer, literal bytes
    // come from another that starts `tileInfo & 0x7F` bytes into the record.
    let dataPtr = dataAddr + (tileInfo & 0x7f);
    let cmdPtr = dataAddr + 1;
    let cmdSecondHalf = false;
    let outPos = 0;

    const read4 = (): number => {
        const val = rom[cmdPtr];
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
        let indicators = rom[dataPtr];
        dataPtr += 1;

        for (let bit = 0; bit < 8; bit++) {
            if (!(indicators & 0x80)) {
                // Literal word straight from the data stream.
                put(rom[dataPtr], rom[dataPtr + 1]);
                dataPtr += 2;
            } else {
                const mode = read4();
                if (mode === 0) put(0x00, 0x00);
                else if (mode === 1) put(0xff, 0x00);
                else if (mode === 2) put(0x00, 0xff);
                else if (mode === 3) put(0xff, 0xff);
                else if (mode === 4) put(rom[dataPtr++], 0x00);
                else if (mode === 5) put(rom[dataPtr++], 0xff);
                else if (mode === 6) put(0x00, rom[dataPtr++]);
                else if (mode === 7) put(0xff, rom[dataPtr++]);
                else if (mode === 8) {
                    const v = rom[dataPtr++];
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
                    put(outPos >= 2 ? out[outPos - 2] : 0, rom[dataPtr++]);
                } else if (mode === 14) {
                    const lo = rom[dataPtr++];
                    put(lo, outPos >= 2 ? out[outPos - 1] : 0);
                } else if (mode === 15) {
                    const v = rom[dataPtr++];
                    put(v, v ^ 0xff);
                }
            }

            if (outPos >= TILE_BYTES) break;
            indicators = (indicators << 1) & 0xff;
        }
    }

    return out;
}

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
