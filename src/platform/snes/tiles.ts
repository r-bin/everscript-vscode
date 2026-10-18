// SNES graphics formats (hardware facts, no game): 4bpp planar 8x8 tiles and BGR555 colours.

/**
 * One 4bpp tile (32 bytes at `offset`) as 64 colour indices, row-major. Rows are two bitplane pairs:
 * planes 0/1 in bytes 2r / 2r+1, planes 2/3 in bytes 16+2r / 17+2r; bit 7 is the left pixel.
 */
export function tile4bpp(bytes: ArrayLike<number>, offset = 0): Uint8Array {
    const out = new Uint8Array(64);
    for (let r = 0; r < 8; r++) {
        const p0 = bytes[offset + 2 * r] ?? 0, p1 = bytes[offset + 2 * r + 1] ?? 0;
        const p2 = bytes[offset + 16 + 2 * r] ?? 0, p3 = bytes[offset + 17 + 2 * r] ?? 0;
        for (let c = 0; c < 8; c++) {
            const m = 0x80 >> c;
            out[r * 8 + c] = (p0 & m ? 1 : 0) | (p1 & m ? 2 : 0) | (p2 & m ? 4 : 0) | (p3 & m ? 8 : 0);
        }
    }
    return out;
}

/** A BGR555 word as 8-bit RGB (each 5-bit channel scaled by repeating its top bits). */
export function bgr555(word: number): [number, number, number] {
    const c = (v: number): number => (v << 3) | (v >> 2);
    return [c(word & 0x1f), c((word >> 5) & 0x1f), c((word >> 10) & 0x1f)];
}
