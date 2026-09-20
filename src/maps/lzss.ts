// Ownership: the 65c816 LZSS sliding-window decompressor at $8C98C9.
// Pure. Dispatch table index 3 (sub_flag 0x03).
//
// Ported from everscript/tools/dump_room.py (LZSSDecompressor).
// See docs/map-format/map_decompression_trace_analysis.md.

const WINDOW_SIZE = 0x1000; // 4KB circular history buffer at WRAM $7FA000..$7FAFFF

class BitReader {
    private bitBuf = 0;
    private bitsLeft = 0;

    constructor(private readonly data: Uint8Array, private bytePtr: number) {}

    bit(): number {
        if (this.bitsLeft === 0) {
            this.bitBuf = this.bytePtr < this.data.length ? this.data[this.bytePtr++] : 0;
            this.bitsLeft = 8;
        }
        const b = (this.bitBuf >> 7) & 1;
        this.bitBuf = (this.bitBuf << 1) & 0xff;
        this.bitsLeft -= 1;
        return b;
    }

    bits(n: number): number {
        let res = 0;
        for (let i = 0; i < n; i++) res = (res << 1) | this.bit();
        return res;
    }
}

/**
 * Decompress an LZSS stream starting at `offset`.
 *
 * Stops at the end-of-stream sentinel (a back-reference with offset 0), or as
 * soon as `targetSize` bytes have been produced when one is given.
 */
export function decompressLzss(data: Uint8Array, offset: number, targetSize?: number): Uint8Array {
    const reader = new BitReader(data, offset);
    const window = new Uint8Array(WINDOW_SIZE);
    const out: number[] = [];
    let winPtr = 0;

    for (;;) {
        if (targetSize !== undefined && out.length >= targetSize) break;

        if (reader.bit() === 1) {
            // Literal byte
            const b = reader.bits(8);
            out.push(b);
            window[winPtr] = b;
            winPtr = (winPtr + 1) & 0xfff;
        } else {
            // 16-bit back-reference
            const token = reader.bits(16);
            const refOffset = token >> 4;
            if (refOffset === 0) break; // end-of-stream sentinel
            const length = (token & 0x0f) + 2;
            let src = (refOffset - 1) & 0xfff;
            for (let i = 0; i < length; i++) {
                const b = window[src];
                src = (src + 1) & 0xfff;
                out.push(b);
                window[winPtr] = b;
                winPtr = (winPtr + 1) & 0xfff;
            }
        }
    }

    return Uint8Array.from(out);
}

/** Uncompressed copy ($8C98B1), dispatch table index 0 (sub_flag 0x00). */
export function copyRaw(data: Uint8Array, offset: number, size: number): Uint8Array {
    return data.slice(offset, offset + size);
}
