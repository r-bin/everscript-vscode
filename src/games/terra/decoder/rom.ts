// Ownership: Terranigma ROM identification and the two room script tables (docs/terra/README.md §3).
// Pure: ROM bytes in, numbers out. Addresses are the European base ROM's (`eu`); the other
// releases are recognised but their tables are elsewhere and not decoded (`isBaseTerraRom`).
import { readHeader, stripCopierHeader, type RomHeader } from '../../../platform/roms/header';
import { sha1Of } from '../../../platform/roms/identify';
import { fileU24, hiromFileOffset } from '../../../platform/snes/hirom';
import { terra } from '../descriptor';

/** File offset of the room table ("Table A", bus $86:959C): one 24-bit pointer per room to its script. Read by $86:9010. */
export const TERRA_BASE_ROOM_TABLE_OFFSET = 0x06959c;

/** File offset of the shared-script table ("Table B", bus $86:A28C): scripts several rooms call or jump to. Read by $86:9035. */
export const TERRA_BASE_TABLE_B_OFFSET = 0x06a28c;

/** Number of room entries in the room table (0x000 to 0x44F). */
export const TERRA_ROOM_COUNT = 1104;

/** The 24-bit value an unused room slot holds instead of a pointer. */
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

const baseSha1 = terra.variants.find(v => v.base)!.sha1;
const baseCache = new WeakMap<Uint8Array, boolean>();

/** True for the European base ROM, the one release whose addresses this decoder knows (SHA-1 match). */
export function isBaseTerraRom(rom: Uint8Array): boolean {
    let ok = baseCache.get(rom);
    if (ok === undefined) { ok = sha1Of(stripCopierHeader(rom)) === baseSha1; baseCache.set(rom, ok); }
    return ok;
}

/**
 * Reads the 24-bit SNES bus address of a room's script from the room table.
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
 * Reads the file offset of a room's script from the room table.
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

/** True when the room slot holds a real script pointer rather than the unused marker ($000002). */
export function isRoomSlotUsed(
    rom: Uint8Array,
    roomId: number,
    tableOffset = TERRA_BASE_ROOM_TABLE_OFFSET,
): boolean {
    const bus = readRoomBusAddress(rom, roomId, tableOffset);
    return bus !== null && bus !== TERRA_UNUSED_SLOT_POINTER;
}
