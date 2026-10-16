// Terranigma ROM structure and table access (docs/terra/).
import { readHeader, stripCopierHeader, type RomHeader } from '../../platform/roms/header';
import { fileU24, hiromFileOffset } from '../../platform/snes/hirom';
import { terra } from './descriptor';

/** PC file offset of Map Table A (room pointers) in the European base ROM ($0D:959C). */
export const TERRA_BASE_ROOM_TABLE_OFFSET = 0x06959c;

/** PC file offset of Map Table B (sub-scripts / event triggers) in the European base ROM ($0D:A28C). */
export const TERRA_BASE_TABLE_B_OFFSET = 0x06a28c;

/** Number of room entries in Table A (0x0000 to 0x044F). */
export const TERRA_ROOM_COUNT = 1104;

/** Magic 24-bit pointer value indicating an unused or unallocated room slot. */
export const TERRA_UNUSED_SLOT_POINTER = 0x000002;

/** True when the ROM bytes have a cartridge header recognized as Terranigma / Tenchi Souzou. */
export function isTerraRom(file: Uint8Array): boolean {
    const rom = stripCopierHeader(file);
    const header = readHeader(rom);
    return !!header && terra.matchesHeader(header);
}

/** Reads the cartridge header of a Terranigma ROM, or null if invalid. */
export function readTerraHeader(file: Uint8Array): RomHeader | null {
    const rom = stripCopierHeader(file);
    const header = readHeader(rom);
    return (header && terra.matchesHeader(header)) ? header : null;
}

/**
 * Reads the 24-bit SNES bus address of a room header from Table A.
 * Returns null if roomId is out of bounds or ROM is too short.
 */
export function readRoomBusAddress(
    rom: Uint8Array,
    roomId: number,
    tableOffset = TERRA_BASE_ROOM_TABLE_OFFSET,
): number | null {
    if (!Number.isInteger(roomId) || roomId < 0 || roomId >= TERRA_ROOM_COUNT) return null;
    const offset = tableOffset + roomId * 3;
    if (offset + 3 > rom.length) return null;
    return fileU24(rom, offset);
}

/**
 * Reads the PC file offset of a room header from Table A.
 * Returns null if roomId is out of bounds, ROM is too short, or the slot is unused ($000002).
 */
export function readRoomFileOffset(
    rom: Uint8Array,
    roomId: number,
    tableOffset = TERRA_BASE_ROOM_TABLE_OFFSET,
): number | null {
    const bus = readRoomBusAddress(rom, roomId, tableOffset);
    if (bus === null || bus === TERRA_UNUSED_SLOT_POINTER) return null;
    return hiromFileOffset(bus);
}

/**
 * True when the room slot contains a real script/map pointer rather than the unused marker ($000002).
 */
export function isRoomSlotUsed(
    rom: Uint8Array,
    roomId: number,
    tableOffset = TERRA_BASE_ROOM_TABLE_OFFSET,
): boolean {
    const bus = readRoomBusAddress(rom, roomId, tableOffset);
    return bus !== null && bus !== TERRA_UNUSED_SLOT_POINTER;
}
