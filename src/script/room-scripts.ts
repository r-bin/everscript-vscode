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
import { extractLoot, isLoot, LootFacts } from './loot';
import { lootToEverscript } from './everscript';
import { extractTransitions, TransitionFacts } from './transition';
import { extractSpawns, SpawnFacts } from './entities';

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
    /** 0 for the script itself, 1+ for rows spliced in from an inlined call. */
    depth: number;
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
    /**
     * What this script gives, when it is a pickup. Read from the literal
     * writes the script makes, not simulated — see loot.ts.
     *
     * A list, because one trigger can gate several pickups behind different
     * calls: Dark Forest's B-trigger RCALLs a different sniff spot per room
     * variant. Each inlined call gets its own record, as upstream does.
     */
    loot: LootFacts[];
    /**
     * The pickups above written back as Everscript, where they can be
     * written exactly. Empty for anything that would not recompile to the
     * same bytes.
     */
    everscript: string[];
    /**
     * Where this script sends the player. Most triggers in the game are
     * doors, and this is the one fact a reader wants from them.
     */
    transitions: TransitionFacts[];
    /**
     * NPCs this script can place. Candidates, not contents — the walk
     * follows every branch, and which one runs depends on save state.
     */
    spawns: SpawnFacts[];
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

function row(rom: Uint8Array, ins: DecodedInstruction, depth: number): ScriptRow {
    return {
        depth,
        addressSnes: ins.address,
        opcode: ins.opcode,
        opcodeHex: u8(ins.opcode),
        size: ins.size,
        bytesHex: bytesHex(rom, ins.address, ins.size),
        // The reference prints a bare "UNKNOWN INSTR"; a reader deserves to
        // know it is a dead end rather than a mystery, so say why here.
        summary: ins.undecodable ? `UNKNOWN INSTR — ${unresolvedNote(ins.opcode)}` : ins.summary,
        terminal: ins.terminal,
        untraced: ins.untraced,
        unsupported: ins.undecodable,
    };
}

/** Upstream's recursion limit for inlined calls, and a total row budget. */
const MAX_INLINE_DEPTH = 3;
const MAX_ROWS = 2048;

interface Walk {
    rows: ScriptRow[];
    /** One entry per decode scope: the script itself, then each inlined call. */
    scopes: DecodedInstruction[][];
}

/**
 * Decode from `addr` into rows, splicing in the scripts it RCALLs.
 *
 * Inlining is not cosmetic. A relative call is how several rooms factor out a
 * pickup — Dark Forest's B-trigger is nine `IF room-variant THEN RCALL sniff`
 * pairs — so a reader that stops at the call sees a branch and no reward.
 * Absolute calls are *not* inlined: those are shared subroutines (fades, room
 * changes) and inlining them would bury the script in boilerplate. That split
 * is upstream's, and it is the one that makes the listing readable.
 *
 * When a walk stops on an opcode nothing can decode, a row is added for that
 * byte. Showing where knowledge ends is more useful than a table that simply
 * stops, and it is what the reference prints in red before giving up.
 */
function walk(rom: Uint8Array, addr: number, depth: number, out: Walk): ReturnType<typeof decodeScript> {
    const res = decodeScript(rom, addr);
    out.scopes.push(res.instructions);
    for (const ins of res.instructions) {
        if (out.rows.length >= MAX_ROWS) break;
        out.rows.push(row(rom, ins, depth));
        if (depth >= MAX_INLINE_DEPTH) continue;
        for (const e of ins.effects) {
            if (e.kind === 'call' && e.inline) walk(rom, e.target, depth + 1, out);
        }
    }
    return res;
}

function script(rom: Uint8Array, pointerSnes: number): RoomScript {
    const rawScriptValue = read24(rom, pointerSnes);
    const scriptAddressSnes = scriptValueToSnes(rawScriptValue);
    const out: Walk = { rows: [], scopes: [] };
    const res = walk(rom, scriptAddressSnes, 0, out);
    const first = out.rows.find((r) => r.opcode !== 0x00);
    // Loot is read per scope, not per script: each inlined call is its own
    // pickup, and merging them would make nine sniff spots look like one.
    const loot = out.scopes.map(extractLoot).filter(isLoot);
    return {
        scriptPointerSnes: pointerSnes,
        rawScriptValue,
        scriptAddressSnes,
        instructions: out.rows,
        terminated: res.stopReason === 'terminated',
        stopReason: res.stopReason,
        label: first ? first.summary : '',
        loot,
        everscript: loot.map(lootToEverscript).filter((l): l is string => l !== null),
        transitions: out.scopes.flatMap(extractTransitions),
        spawns: out.scopes.flatMap(extractSpawns),
    };
}

type TriggerRow = { x1: number; y1: number; x2: number; y2: number; scriptId: number };

/** The rectangle and script id of every entry in one trigger table. */
function triggerRows(rom: Uint8Array, tableRom: number, length: number): TriggerRow[] {
    const out: TriggerRow[] = [];
    if (!length || length < TRIGGER_ENTRY_SIZE) return out;
    if (length % TRIGGER_ENTRY_SIZE !== 0 || length > MAX_TRIGGER_ENTRIES * TRIGGER_ENTRY_SIZE) return out;
    for (let pos = 0; pos < length; pos += TRIGGER_ENTRY_SIZE) {
        const at = tableRom + pos;
        out.push({
            y1: rom[at + 0], x1: rom[at + 1], y2: rom[at + 2], x2: rom[at + 3],
            scriptId: rom[at + 4] | (rom[at + 5] << 8),
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
    const decode = (t: TriggerRow): RoomTrigger =>
        ({ ...t, ...script(rom, mapscriptTableSnes + t.scriptId) });

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
        stepOn: triggerRows(rom, stepTableRom, stepLength).map(decode),
        bTrigger: triggerRows(rom, bLengthRom + 2, bLength).map(decode),
    };
}
