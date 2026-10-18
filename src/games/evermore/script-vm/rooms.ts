// Ownership: where a room's scripts start — its enter script and its trigger rectangles. Pure.
//
// Tables (US layout, src/games/evermore/variants.json):
//   room_enter_scripts  $92:801B + 5 * room: a packed script pointer (0 = none) and a word
//                       (read by the room loader at $8C:CECC)
//   map_table           $9F:FDE7 + 4 * room: the room's data blob (24-bit pointer + pad)
//   blob + $0D          step-on triggers: [length:2] then 6-byte entries
//   after them          B triggers (press B inside): [length:2] then 6-byte entries
//   entry               y1, x1, y2, x2 (tiles), script id: a byte offset into the pointer table
//                       at $92:8000 + word[$92:8000] (as opcode 0xA4)

import { busU8 } from '../../../platform/snes/hirom';
import { SCRIPT_HEADER, ScriptRom, unpack } from './address';
import { getMapTableOffset, getRoomEnterScriptsOffset, getTableCount } from '../variant-resolver';

export interface Trigger {
    kind: 'step' | 'b';
    x1: number; y1: number; x2: number; y2: number;
    /** Byte offset into the trigger pointer table. */
    id: number;
    /** Where its packed pointer is (bus). */
    pointer: number;
    script: number;
}

/** One trigger table in the room's data blob: its entries start at `at` (bus). */
export interface TriggerTable { at: number; length: number; count: number }

export interface RoomScripts {
    room: number;
    /** The enter script, or null when the room has none. */
    enter: number | null;
    /** Where the enter script's packed pointer is (bus), and the packed value. */
    enterPointer: number;
    enterPacked: number;
    /** The room's data blob (bus) and its two trigger tables. */
    blob: number;
    step: TriggerTable;
    b: TriggerTable;
    triggers: Trigger[];
}

const TRIGGER_TABLE = 0x0D;
const TRIGGER_SIZE = 6;

export function roomCount(rom: ScriptRom): number {
    return getTableCount('room_enter_scripts', rom.rom);
}

export function roomScripts(rom: ScriptRom, room: number): RoomScripts {
    const bytes = rom.rom;
    const enterAt = getRoomEnterScriptsOffset(bytes) + 5 * room;
    const packed = bytes[enterAt] | (bytes[enterAt + 1] << 8) | (bytes[enterAt + 2] << 16);
    const enter = packed === 0 ? null : unpack(packed);
    const mapAt = getMapTableOffset(bytes) + 4 * room;
    const blob = bytes[mapAt] | (bytes[mapAt + 1] << 8) | (bytes[mapAt + 2] << 16);
    const triggers: Trigger[] = [];
    const tables: Record<'step' | 'b', TriggerTable> = { step: { at: 0, length: 0, count: 0 }, b: { at: 0, length: 0, count: 0 } };
    let p = blob + TRIGGER_TABLE;
    for (const kind of ['step', 'b'] as const) {
        const length = busU8(bytes, p) | (busU8(bytes, p + 1) << 8);
        p += 2;
        if (length % TRIGGER_SIZE !== 0 || length > 100 * TRIGGER_SIZE) break;
        tables[kind] = { at: p, length, count: length / TRIGGER_SIZE };
        for (let e = p; e < p + length; e += TRIGGER_SIZE) {
            const id = busU8(bytes, e + 4) | (busU8(bytes, e + 5) << 8);
            triggers.push({ kind, y1: busU8(bytes, e), x1: busU8(bytes, e + 1), y2: busU8(bytes, e + 2), x2: busU8(bytes, e + 3), id, pointer: SCRIPT_HEADER + rom.header(0) + id, script: rom.triggerScript(id) });
        }
        p += length;
    }
    // The table is in the upper half of its bank, so the $80 mirror of the file offset is its bus address.
    return { room, enter, enterPointer: 0x800000 | enterAt, enterPacked: packed, blob, step: tables.step, b: tables.b, triggers };
}

/** Every script entry the tables name: rooms, their triggers, the whole pointer table, the header's pointer. */
export function allEntries(rom: ScriptRom): Set<number> {
    const out = new Set<number>();
    const add = (a: number | null): void => { if (a !== null && rom.contains(a)) out.add(a); };
    for (let r = 0; r < roomCount(rom); r++) {
        const s = roomScripts(rom, r);
        add(s.enter);
        for (const t of s.triggers) add(t.script);
    }
    for (const off of rom.tableOffsets()) add(rom.triggerScript(off));
    // The header's packed pointer at $92:800C (the game runs it; see knowledge rom/92de49).
    add(unpack(rom.u24(0x92800C)));
    return out;
}
