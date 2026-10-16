// Ownership: the two bitstream compressors of the room write path — LZSS
// ($8C98C9) and the 2D Markov grid ($8C9BD0). Pure.
//
// Ported from everscript/tools/encode_room.py. Each is the inverse of its
// decoder in lzss.ts / markov.ts; encode.ts wraps them into blocks.

// ---------------------------------------------------------------------------
// Bit I/O
// ---------------------------------------------------------------------------

/** MSB-first bit stream, matching the decoders' reads. */
class BitWriter {
    private readonly out: number[] = [];
    private acc = 0;
    private n = 0;

    write(value: number, bits: number): void {
        for (let i = bits - 1; i >= 0; i--) {
            this.acc = (this.acc << 1) | ((value >>> i) & 1);
            this.n += 1;
            if (this.n === 8) {
                this.out.push(this.acc & 0xff);
                this.acc = 0;
                this.n = 0;
            }
        }
    }

    flush(): Uint8Array {
        if (this.n) {
            this.out.push((this.acc << (8 - this.n)) & 0xff);
            this.acc = 0;
            this.n = 0;
        }
        return Uint8Array.from(this.out);
    }
}

// ---------------------------------------------------------------------------
// LZSS compressor (inverse of lzss.ts, $8C98C9)
// ---------------------------------------------------------------------------

const MAX_MATCH = 17; // length nibble + 2
const WINDOW_SIZE = 0x1000;

/**
 * A stream the engine's LZSS decompressor turns back into `data`.
 *
 *     bit 1   -> 8-bit literal follows
 *     bit 0   -> 16-bit token: offset = token >> 4 (0 ends the stream),
 *                length = (token & 0x0F) + 2, source read from window
 *                index (offset - 1) & 0xFFF
 *
 * The 4 KB window starts zeroed and advances one slot per emitted byte.
 */
export function lzssCompress(data: Uint8Array, maxCandidates = 64): Uint8Array {
    const bw = new BitWriter();
    const window = new Uint8Array(WINDOW_SIZE);
    let winPtr = 0;
    // 3-byte key -> recent absolute output positions, newest last.
    const index = new Map<number, number[]>();
    const n = data.length;
    const key = (at: number): number => (data[at] << 16) | (data[at + 1] << 8) | data[at + 2];
    const remember = (at: number): void => {
        if (at + 3 > n) return;
        const k = key(at);
        const list = index.get(k);
        if (list) list.push(at); else index.set(k, [at]);
    };
    const emitByte = (b: number): void => {
        window[winPtr] = b;
        winPtr = (winPtr + 1) & 0xfff;
    };

    /**
     * How many bytes the decoder would copy from window index `src`. It
     * writes each copied byte back into the window as it goes, so a
     * self-overlapping match reads bytes it has just produced — mirrored
     * exactly here, or long runs corrupt silently.
     */
    const matchLength = (src: number, at: number): number => {
        let probe = src;
        let wp = winPtr;
        const written = new Map<number, number>();
        let length = 0;
        while (length < MAX_MATCH && at + length < n) {
            const b = written.has(probe) ? written.get(probe)! : window[probe];
            if (b !== data[at + length]) break;
            written.set(wp, b);
            probe = (probe + 1) & 0xfff;
            wp = (wp + 1) & 0xfff;
            length += 1;
        }
        return length;
    };

    let pos = 0;
    while (pos < n) {
        let bestLen = 0;
        let bestSrc = 0;
        if (pos + 3 <= n) {
            const cands = index.get(key(pos)) || [];
            for (let i = cands.length - 1; i >= Math.max(0, cands.length - maxCandidates); i--) {
                const dist = pos - cands[i];
                if (dist <= 0 || dist > WINDOW_SIZE) continue;
                const src = (winPtr - dist) & 0xfff;
                if (src === 0xfff) continue; // offset would encode as 0, the end marker
                const length = matchLength(src, pos);
                if (length > bestLen) {
                    bestLen = length;
                    bestSrc = src;
                    if (length === MAX_MATCH) break;
                }
            }
        }

        if (bestLen >= 3) {
            bw.write(0, 1);
            bw.write((((bestSrc + 1) & 0xfff) << 4) | (bestLen - 2), 16);
            for (let k = 0; k < bestLen; k++) {
                remember(pos + k);
                emitByte(data[pos + k]);
            }
            pos += bestLen;
        } else {
            bw.write(1, 1);
            bw.write(data[pos], 8);
            remember(pos);
            emitByte(data[pos]);
            pos += 1;
        }
    }

    // End of stream: a reference token with offset 0.
    bw.write(0, 1);
    bw.write(0, 16);
    return bw.flush();
}

// ---------------------------------------------------------------------------
// Markov grid encoder (inverse of markov.ts, $8C9BD0)
// ---------------------------------------------------------------------------

/**
 * Encode a metatile grid into the 2D context-predictive bitstream.
 *
 *     1        (1 bit)              -> table[above][0]
 *     000      (3 bits)             -> table[left][1]
 *     0011     (4 bits)             -> the next sequential metatile
 *     00100    (5 bits)             -> table[above][2]
 *     00101    (5 bits)             -> table[left][3]
 *     01       (2 bits + tileBits)  -> literal metatile index
 *
 * Runs the decoder's model and picks the cheapest token that reproduces the
 * wanted value — except that the next sequential metatile always uses
 * `0011`, the only token that widens `tileBits`. Hence the rule a grid must
 * obey: **new metatiles are introduced in ascending order**. Throws rather
 * than write a stream that decodes to something else.
 */
export function encodeMarkovGrid(
    grid: ArrayLike<number>, width: number, height: number, baseMetatile: number, fc4 = 0,
): Uint8Array {
    const stride = width * 2;
    const table = new Map<number, number[]>();
    for (let tid = baseMetatile; tid < baseMetatile + 0x0800; tid += 8) table.set(tid, [tid, tid, tid, tid]);

    let tileCounter = fc4;
    let nextSeqTile = baseMetatile + fc4 * 8;
    let tileMask = 1;
    let tileBits = 0;
    for (let tmp = fc4; tmp > 0; tmp >>= 1) {
        tileMask <<= 1;
        tileBits += 1;
    }

    let aboveTile = baseMetatile;
    let leftTile = baseMetatile;
    const bw = new BitWriter();
    const slot = (tid: number, i: number): number | undefined => {
        const e = table.get(tid);
        return e ? e[i] : undefined;
    };

    for (let idx = 0; idx < width * height; idx++) {
        const byteY = idx * 2;
        const val = grid[idx];

        if (val === nextSeqTile) {
            bw.write(0b0011, 4);
            nextSeqTile += 8;
            if (!table.has(val)) table.set(val, [val, val, val, val]);
            tileCounter += 1;
            if ((tileCounter & tileMask) !== 0) {
                tileMask <<= 1;
                tileBits += 1;
            }
        } else if (slot(aboveTile, 0) === val) {
            bw.write(0b1, 1);
        } else if (slot(leftTile, 1) === val) {
            bw.write(0b000, 3);
        } else if (slot(aboveTile, 2) === val) {
            bw.write(0b00100, 5);
        } else if (slot(leftTile, 3) === val) {
            bw.write(0b00101, 5);
        } else {
            const tIdx = Math.floor((val - baseMetatile) / 8);
            if (tIdx < 0 || tIdx >= (1 << tileBits)) {
                throw new Error(`metatile 0x${val.toString(16)} (index ${tIdx}) does not fit the `
                    + `${tileBits}-bit literal field at cell ${idx}; the grid must introduce `
                    + 'metatiles in ascending order so the sequential token can widen it');
            }
            bw.write(0b01, 2);
            bw.write(tIdx, tileBits);
        }

        if (!table.has(val)) table.set(val, [val, val, val, val]);

        if (byteY >= stride) {
            const above = table.get(aboveTile)!;
            if (val !== above[2]) above[2] = above[0];
            above[0] = val;
        }

        const left = table.get(leftTile)!;
        if (val !== left[3]) left[3] = left[1];
        left[1] = val;
        leftTile = val;

        const nextByteY = byteY + 2;
        if (nextByteY >= stride) aboveTile = grid[(nextByteY - stride) / 2];
    }

    return bw.flush();
}
