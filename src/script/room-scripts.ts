// Ownership: finding the scripts a room runs, and decoding them. Pure.
//
// A room reaches script code three ways: the enter script that runs on load,
// step-on triggers (walk into the rectangle) and B-triggers (press B inside
// it). All three are pointers into the same script bank; only the tables that
// hold them differ.
//
// Table layout, all verified against the ROM:
//
//   $9FFDE7 + mapId*4        24-bit pointer to the room's data blob
//   blob + 0x0D              [len:2][step-on entries]
//   ... + len                [len:2][B-trigger entries]
//   entry                    [y1][x1][y2][x2][scriptId:2]
//   $928000 + 0x1B + 5*id    the enter script's packed pointer
//   $928000 + *$928000       base of the id-indexed script pointer table
//
// A trigger's `scriptId` is a byte offset into that pointer table, not an
// index, which is why the ids are multiples of three.

import { read16, read24, scriptValueToSnes, snesToRom, u8, SCRIPTS_START_ADDR_US } from './addressing';
import { decodeScript, unresolvedNote, DecodedInstruction, StopReason } from './decoder';

const MAP_LIST_ADDR_US = 0x9ffde7;
const ENTER_SCRIPT_TABLE_OFFSET = 0x1b;
const TRIGGER_TABLE_OFFSET = 0x0d;
const TRIGGER_ENTRY_SIZE = 6;
const MAX_TRIGGER_ENTRIES = 100;

/** One decoded instruction, in the shape the Rooms tab renders. */
export interface ScriptRow {
    addressSnes: number;
    opcode: number;
    opcodeHex: string;
    size: number;
    bytesHex: string;
    summary: string;
    terminal: boolean;
    /** The length is known but the description is a guess, not a trace. */
    untraced: boolean;
    /** No case exists for this opcode: the walk ends here. */
    unsupported: boolean;
}

export interface RoomScript {
    scriptPointerSnes: number;
    rawScriptValue: number;
    scriptAddressSnes: number;
    instructions: ScriptRow[];
    terminated: boolean;
    stopReason: StopReason;
    /** What the script does first, for a one-line preview. */
    label: string;
}

export interface RoomTrigger extends RoomScript {
    x1: number; y1: number; x2: number; y2: number;
    scriptId: number;
}

/** Where the tables were found — shown as-is, so a bad room is diagnosable. */
export interface RoomScriptMeta {
    stepTableRom: number;
    stepLength: number;
    stepCount: number;
    bTableRom: number;
    bLength: number;
    bCount: number;
    enterPointerSnes: number;
    enterRawValue: number;
}

export interface RoomScriptModel {
    mapId: number;
    dataPointerSnes: number;
    mapscriptTableSnes: number;
    meta: RoomScriptMeta;
    enter: RoomScript;
    stepOn: RoomTrigger[];
    bTrigger: RoomTrigger[];
}

/** The data blob's pointer is banked differently from ordinary SNES addresses. */
function blobRom(dataSnes: number): number {
    return ((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff);
}

function bytesHex(rom: Uint8Array, addr: number, size: number): string {
    const out: string[] = [];
    const base = snesToRom(addr);
    for (let i = 0; i < size; i++) out.push((rom[base + i] ?? 0).toString(16).padStart(2, '0').toUpperCase());
    return out.join(' ');
}

function row(rom: Uint8Array, ins: DecodedInstruction): ScriptRow {
    return {
        addressSnes: ins.address,
        opcode: ins.opcode,
        opcodeHex: u8(ins.opcode),
        size: ins.size,
        bytesHex: bytesHex(rom, ins.address, ins.size),
        summary: ins.summary,
        terminal: ins.terminal,
        untraced: ins.untraced,
        unsupported: false,
    };
}

/**
 * Decode from `addr` into rows.
 *
 * When the walk stops on an opcode nothing can decode, a final row is added
 * for that byte. Showing where knowledge ends is more useful than a table
 * that simply stops, and it is the same thing the reference dumper prints in
 * red before giving up.
 */
function decodeRows(rom: Uint8Array, addr: number): { rows: ScriptRow[]; res: ReturnType<typeof decodeScript> } {
    const res = decodeScript(rom, addr);
    const rows = res.instructions.map((ins) => row(rom, ins));
    if (res.stopReason === 'unknown-opcode' && res.stoppedAt !== null) {
        const opcode = rom[snesToRom(res.stoppedAt)] ?? 0;
        rows.push({
            addressSnes: res.stoppedAt,
            opcode,
            opcodeHex: u8(opcode),
            size: 1,
            bytesHex: bytesHex(rom, res.stoppedAt, 1),
            summary: `UNKNOWN INSTR ${unresolvedNote(opcode)}`,
            terminal: false,
            untraced: false,
            unsupported: true,
        });
    }
    return { rows, res };
}

function script(rom: Uint8Array, pointerSnes: number): RoomScript {
    const rawScriptValue = read24(rom, pointerSnes);
    const scriptAddressSnes = scriptValueToSnes(rawScriptValue);
    const { rows, res } = decodeRows(rom, scriptAddressSnes);
    const first = rows.find((r) => r.opcode !== 0x00);
    return {
        scriptPointerSnes: pointerSnes,
        rawScriptValue,
        scriptAddressSnes,
        instructions: rows,
        terminated: res.stopReason === 'terminated',
        stopReason: res.stopReason,
        label: first ? first.summary : '',
    };
}

function triggers(rom: Uint8Array, tableRom: number, length: number, tableSnes: number): RoomTrigger[] {
    const out: RoomTrigger[] = [];
    if (!length || length < TRIGGER_ENTRY_SIZE) return out;
    if (length % TRIGGER_ENTRY_SIZE !== 0 || length > MAX_TRIGGER_ENTRIES * TRIGGER_ENTRY_SIZE) return out;
    for (let pos = 0; pos < length; pos += TRIGGER_ENTRY_SIZE) {
        const at = tableRom + pos;
        const scriptId = rom[at + 4] | (rom[at + 5] << 8);
        out.push({
            y1: rom[at + 0], x1: rom[at + 1], y2: rom[at + 2], x2: rom[at + 3],
            scriptId,
            ...script(rom, tableSnes + scriptId),
        });
    }
    return out;
}

/** Everything the Rooms tab needs about one room's scripts. */
export function buildRoomScriptModel(rom: Uint8Array, mapId: number): RoomScriptModel {
    const dataPointerSnes = read24(rom, MAP_LIST_ADDR_US + mapId * 4);
    const dataRom = blobRom(dataPointerSnes);
    const stepLength = rom[dataRom + TRIGGER_TABLE_OFFSET] | (rom[dataRom + TRIGGER_TABLE_OFFSET + 1] << 8);
    const stepTableRom = dataRom + TRIGGER_TABLE_OFFSET + 2;
    const bLengthRom = stepTableRom + stepLength;
    const bLength = rom[bLengthRom] | (rom[bLengthRom + 1] << 8);
    const mapscriptTableSnes = SCRIPTS_START_ADDR_US + read16(rom, SCRIPTS_START_ADDR_US);
    const enterPointerSnes = SCRIPTS_START_ADDR_US + ENTER_SCRIPT_TABLE_OFFSET + 5 * mapId;

    return {
        mapId,
        dataPointerSnes,
        mapscriptTableSnes,
        meta: {
            stepTableRom,
            stepLength,
            stepCount: Math.floor(stepLength / TRIGGER_ENTRY_SIZE),
            bTableRom: bLengthRom + 2,
            bLength,
            bCount: Math.floor(bLength / TRIGGER_ENTRY_SIZE),
            enterPointerSnes,
            enterRawValue: read24(rom, enterPointerSnes),
        },
        enter: script(rom, enterPointerSnes),
        stepOn: triggers(rom, stepTableRom, stepLength, mapscriptTableSnes),
        bTrigger: triggers(rom, bLengthRom + 2, bLength, mapscriptTableSnes),
    };
}
