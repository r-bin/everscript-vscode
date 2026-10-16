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

export interface DecodedRoomHeaderOpcode {
    opcode: number;
    name: string;
    bytes: number[];
    summary: string;
}

export interface DecodedRoomHeader {
    roomId: number;
    busAddress: number;
    fileOffset: number;
    rawBytes: number[];
    spcTrack: number | null;
    opcodes: DecodedRoomHeaderOpcode[];
}

/**
 * Reads the raw byte stream of a room header up to the 0x00 terminator (or maxBytes).
 */
export function readRoomHeaderBytes(
    rom: Uint8Array,
    roomId: number,
    maxBytes = 64,
    tableOffset = TERRA_BASE_ROOM_TABLE_OFFSET,
): Uint8Array | null {
    const offset = readRoomFileOffset(rom, roomId, tableOffset);
    if (offset === null || offset >= rom.length) return null;
    const end = Math.min(rom.length, offset + maxBytes);
    let len = 0;
    while (offset + len < end) {
        const b = rom[offset + len];
        len++;
        if (b === 0x00) break; // end of header
    }
    return rom.slice(offset, offset + len);
}

/**
 * Decodes a Terranigma room header byte stream into parsed opcodes and music tags.
 */
export function decodeRoomHeader(
    rom: Uint8Array,
    roomId: number,
    tableOffset = TERRA_BASE_ROOM_TABLE_OFFSET,
): DecodedRoomHeader | null {
    const bus = readRoomBusAddress(rom, roomId, tableOffset);
    const file = readRoomFileOffset(rom, roomId, tableOffset);
    if (bus === null || file === null) return null;

    const raw = readRoomHeaderBytes(rom, roomId, 64, tableOffset);
    if (!raw || raw.length === 0) return null;

    const opcodes: DecodedRoomHeaderOpcode[] = [];
    let spcTrack: number | null = null;
    let i = 0;

    while (i < raw.length) {
        const op = raw[i++];
        if (op === 0x00) {
            opcodes.push({ opcode: 0x00, name: 'End of Header', bytes: [0x00], summary: 'Terminates header' });
            break;
        } else if (op === 0x02) {
            const track = i < raw.length ? raw[i++] : 0;
            spcTrack = track;
            opcodes.push({ opcode: 0x02, name: 'Play SPC Track', bytes: [op, track], summary: `SPC Track $${track.toString(16).padStart(2, '0').toUpperCase()}` });
        } else if (op === 0x04) {
            opcodes.push({ opcode: 0x04, name: 'Call MapID 0 Script', bytes: [op], summary: 'Execute Map 0 SPC sequence' });
        } else if (op === 0x10) {
            const b1 = i < raw.length ? raw[i++] : 0;
            const b2 = i < raw.length ? raw[i++] : 0;
            opcodes.push({ opcode: 0x10, name: 'Map Layers / Tile Defs', bytes: [op, b1, b2], summary: `Layers definition ($${b1.toString(16).padStart(2, '0')}, $${b2.toString(16).padStart(2, '0')})` });
        } else if (op === 0x20) {
            const b1 = i < raw.length ? raw[i++] : 0;
            const b2 = i < raw.length ? raw[i++] : 0;
            opcodes.push({ opcode: 0x20, name: 'Tile Map / Collision', bytes: [op, b1, b2], summary: `Tilemap / Collision data ($${b1.toString(16).padStart(2, '0')}, $${b2.toString(16).padStart(2, '0')})` });
        } else if (op === 0x40) {
            const b1 = i < raw.length ? raw[i++] : 0;
            const b2 = i < raw.length ? raw[i++] : 0;
            opcodes.push({ opcode: 0x40, name: 'Palette Data', bytes: [op, b1, b2], summary: `Palette definition ($${b1.toString(16).padStart(2, '0')}, $${b2.toString(16).padStart(2, '0')})` });
        } else {
            opcodes.push({ opcode: op, name: `Unknown Opcode $${op.toString(16).padStart(2, '0').toUpperCase()}`, bytes: [op], summary: 'Uncategorized bytecode' });
        }
    }

    return {
        roomId,
        busAddress: bus,
        fileOffset: file,
        rawBytes: Array.from(raw),
        spcTrack,
        opcodes,
    };
}


