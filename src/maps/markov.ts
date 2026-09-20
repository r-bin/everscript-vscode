// Ownership: the 2D context-predictive Markov bitstream decoder at $8C9BD0.
// Pure. Dispatch table index 7 (sub_flag 0x07). Produces the metatile grid.
//
// Ported from everscript/tools/dump_room.py (decompress_markov_grid).
// See docs/map-format/map_decompression_trace_analysis.md.

/** Per-tile context slots: [above0, left1, above2, left3]. */
type ContextEntry = [number, number, number, number];

const CONTEXT_SPAN = 0x0800; // tile IDs are pre-seeded across this span, 8 bytes apart

/**
 * Decode the 2D metatile layout grid.
 *
 * @param rom            ROM byte buffer.
 * @param streamOffset   ROM file offset of the compressed bitstream (block2 + 5).
 * @param width          Room width in 16x16 metatiles.
 * @param height         Room height in 16x16 metatiles.
 * @param baseMetatile   WRAM base for metatile entries (width * height * 2).
 * @param fc4            Section 4's initial metatile counter ($0FC4).
 * @returns              `width * height` metatile IDs in row-major order.
 */
export function decompressMarkovGrid(
    rom: Uint8Array,
    streamOffset: number,
    width: number,
    height: number,
    baseMetatile: number,
    fc4 = 0,
): number[] {
    const grid = new Array<number>(width * height).fill(0);
    const stride = width * 2;

    const table = new Map<number, ContextEntry>();
    for (let tid = baseMetatile; tid < baseMetatile + CONTEXT_SPAN; tid += 8) {
        table.set(tid, [tid, tid, tid, tid]);
    }
    const ensure = (tid: number): ContextEntry => {
        let e = table.get(tid);
        if (!e) {
            e = [tid, tid, tid, tid];
            table.set(tid, e);
        }
        return e;
    };

    let ptr = streamOffset;
    let bitOffset = 0;

    const byteAt = (i: number): number => (i < rom.length ? rom[i] : 0);

    const peek5Bits = (): number => {
        const w = (byteAt(ptr) << 16) | (byteAt(ptr + 1) << 8) | byteAt(ptr + 2);
        return (w >>> (19 - bitOffset)) & 0x1f;
    };

    const advance = (n: number): void => {
        bitOffset += n;
        ptr += bitOffset >> 3;
        bitOffset &= 7;
    };

    const readBits = (n: number): number => {
        if (n === 0) return 0;
        const w = (byteAt(ptr) << 16) | (byteAt(ptr + 1) << 8) | byteAt(ptr + 2);
        const res = (w >>> (24 - bitOffset - n)) & ((1 << n) - 1);
        advance(n);
        return res;
    };

    // Native 65816 initialization ($8C9B9B..$8C9BC5): the literal-index field
    // width grows with the running tile counter, seeded from $0FC4.
    let tileCounter = fc4;
    let nextSeqTile = baseMetatile + fc4 * 8;
    let tileMask = 1;
    let tileBits = 0;
    for (let t = fc4; t > 0; t >>= 1) {
        tileMask <<= 1;
        tileBits += 1;
    }

    let aboveTile = baseMetatile;
    let leftTile = baseMetatile;

    for (let idx = 0; idx < width * height; idx++) {
        const byteY = idx * 2;
        const op = peek5Bits();
        let val: number;

        if (op >= 16) {
            // 1-bit token (1) -> above[0]
            advance(1);
            val = ensure(aboveTile)[0];
        } else if (op >= 8) {
            // 2-bit token (01) -> literal tile index
            advance(2);
            const tIdx = readBits(tileBits);
            val = baseMetatile + tIdx * 8;
        } else if (op >= 6) {
            // 4-bit token (0011) -> next sequential tile
            advance(4);
            val = nextSeqTile;
            nextSeqTile += 8;
            ensure(val);
            tileCounter += 1;
            if ((tileCounter & tileMask) !== 0) {
                tileMask <<= 1;
                tileBits += 1;
            }
        } else if (op === 5) {
            // 5-bit token (00101) -> left[3]
            advance(5);
            val = ensure(leftTile)[3];
        } else if (op === 4) {
            // 5-bit token (00100) -> above[2]
            advance(5);
            val = ensure(aboveTile)[2];
        } else {
            // 3-bit token (000) -> left[1]
            advance(3);
            val = ensure(leftTile)[1];
        }

        grid[idx] = val;
        ensure(val);

        // Update context model ($8C9BF3)
        if (byteY >= stride) {
            const above = ensure(aboveTile);
            if (val !== above[2]) above[2] = above[0];
            above[0] = val;
        }

        const left = ensure(leftTile);
        if (val !== left[3]) left[3] = left[1];
        left[1] = val;
        leftTile = val;

        const nextByteY = byteY + 2;
        if (nextByteY >= stride) {
            aboveTile = grid[(nextByteY - stride) / 2];
        }
    }

    return grid;
}
