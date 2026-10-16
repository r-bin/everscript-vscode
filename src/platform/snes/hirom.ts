// HiROM addressing and little-endian reads (SNES hardware facts, no game). One owner for what used to be
// copied per domain (docs/cleanup.md 5.1).
//
// In a HiROM image (map mode $21/$31) banks $C0-$FF map the file linearly and $00-$3F / $80-$BF mirror their
// upper halves, so the top two bank bits drop out: $93:84D9, $D3:84D9 and file offset $1384D9 are one byte.
// ExHiROM (banks $40-$7D for the upper 4 MB) is not covered here; see tools/exhirom.

/** File offset of a HiROM bus address (any mirror). */
export function hiromFileOffset(bus: number): number {
    return bus & 0x3fffff;
}

/** 16-bit little-endian value at a file offset (0 past the end). */
export function fileU16(bytes: ArrayLike<number>, offset: number): number {
    return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

/** 24-bit little-endian value at a file offset (0 past the end). */
export function fileU24(bytes: ArrayLike<number>, offset: number): number {
    return fileU16(bytes, offset) | ((bytes[offset + 2] ?? 0) << 16);
}

/** Byte at a HiROM bus address (0 past the end). */
export function busU8(rom: ArrayLike<number>, bus: number): number {
    return rom[hiromFileOffset(bus)] ?? 0;
}

/** 16-bit little-endian value at a HiROM bus address. */
export function busU16(rom: ArrayLike<number>, bus: number): number {
    return fileU16(rom, hiromFileOffset(bus));
}

/** 24-bit little-endian value at a HiROM bus address. */
export function busU24(rom: ArrayLike<number>, bus: number): number {
    return fileU24(rom, hiromFileOffset(bus));
}
