// Ownership: SNES ROM address translation and little-endian reads.
// Pure. No VS Code API, no filesystem.
//
// Ported from everscript/tools/dump_room.py. See docs/map-format/.

/** ROM file offset for the master map pointer table (SNES $9FFDE7, HiROM). */
export const MAP_LIST_ADDR = 0x1ffde7;

/** Number of room entries in the map pointer table. Entry 0x7F is not a room. */
export const MAX_ROOMS = 127;

/** Bytes per map pointer table entry: a 24-bit pointer plus one padding byte. */
export const MAP_TABLE_STRIDE = 4;

import { hiromFileOffset, fileU16, fileU24 } from '../../../platform/snes/hirom';
import { getMapTableOffset } from '../variant-resolver';
import { hex as upperHex } from '../../../platform/hex';

/** Translate a SNES 24-bit FastROM/HiROM address to a ROM file offset. */
export const snesToRom = hiromFileOffset;

/** Dynamic ROM file offset for the master map pointer table (US: 0x1FFDE7, PAL: 0x20FDE5). */
export function mapTableOffset(rom?: Uint8Array | string): number {
    return rom ? getMapTableOffset(rom) : MAP_LIST_ADDR;
}

/** Read a 16-bit little-endian value at a file offset. */
export const read16 = fileU16;

/** Read a 24-bit little-endian value at a file offset. */
export const read24 = fileU24;

/** Byte at `offset`, or 0 when past the end — matches the Python readers' guards. */
export function readByte(rom: Uint8Array, offset: number): number {
    return offset >= 0 && offset < rom.length ? rom[offset] : 0;
}

/**
 * File offset of a pointer the game follows, in this image: HiROM, or an ExHiROM image (over 4 MB) whose banks
 * $40-$7D map its second 4 MB (docs/exhirom/port.md; Open Evermore places rooms and tiles there). Vanilla never
 * points into $40-$7D, so in a HiROM image this is `snesToRom`.
 */
export function romFileOffset(rom: Uint8Array, bus: number): number {
    const bank = bus >> 16;
    if (rom.length > 0x400000 && bank >= 0x40 && bank <= 0x7d) return 0x400000 + ((bank - 0x40) << 16) + (bus & 0xffff);
    return snesToRom(bus);
}

/** ROM file offset of a room's blob, resolved through the map pointer table. */
export function roomBlobOffset(rom: Uint8Array, roomId: number): number {
    const tableAddr = mapTableOffset(rom);
    return romFileOffset(rom, read24(rom, tableAddr + roomId * MAP_TABLE_STRIDE));
}

/** Format a number as a fixed-width `0x`-prefixed uppercase hex string. */
export function hex(value: number, width = 4): string {
    return '0x' + upperHex(value, width);
}
