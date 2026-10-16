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

/** Translate a SNES 24-bit FastROM/HiROM address to a ROM file offset. */
export const snesToRom = hiromFileOffset;

/** Read a 16-bit little-endian value at a file offset. */
export const read16 = fileU16;

/** Read a 24-bit little-endian value at a file offset. */
export const read24 = fileU24;

/** Byte at `offset`, or 0 when past the end — matches the Python readers' guards. */
export function readByte(rom: Uint8Array, offset: number): number {
    return offset >= 0 && offset < rom.length ? rom[offset] : 0;
}

/** ROM file offset of a room's blob, resolved through the map pointer table. */
export function roomBlobOffset(rom: Uint8Array, roomId: number): number {
    return snesToRom(read24(rom, MAP_LIST_ADDR + roomId * MAP_TABLE_STRIDE));
}

/** Format a number as a fixed-width `0x`-prefixed uppercase hex string. */
export function hex(value: number, width = 4): string {
    return '0x' + value.toString(16).toUpperCase().padStart(width, '0');
}
