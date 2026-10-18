// Ownership: everything the editor shows about a room's scripts — the enter script and each
// trigger as a listing in the compiler's notation, with what it gives (loot), where it leads
// (doors) and whom it places (spawns) — built on script-vm. Pure: takes the user's ROM.

import { hiromFileOffset } from '../../../platform/snes/hirom';
import { Instruction, Names, SCRIPT_HEADER, ScriptRom, facts, roomScripts, text, walk } from '../script-vm';
import { doorsOf, TransitionFacts } from './doors';
import { LootFacts, lootOf, lootToEverscript } from './loot';
import { enemyName, printNames } from './names';
import { paths } from './paths';

/** One instruction as a listing row. */
export interface ScriptRow {
    addressSnes: number;
    opcode: number;
    opcodeHex: string;
    size: number;
    bytesHex: string;
    /** The instruction in the compiler's notation (script-vm `text`). */
    summary: string;
    /** It ends the script (end, reset, change map). */
    terminal: boolean;
    /** Its handler has not been read for meaning yet: the operands are right, the name is not. */
    untraced: boolean;
    /** The game cannot run it: the listing stops here. */
    unsupported: boolean;
    depth: number;
}

export type StopReason = 'terminated' | 'unknown-opcode' | 'bad-operand' | 'none';

export interface SpawnFacts {
    /** The ENEMY value. */
    npc: number;
    /** The compiler's constant, e.g. `FLOWER_PURPLE`. */
    name: string | null;
    /** The game's name, e.g. `Wimpy Flower`. */
    romName: string | null;
    /** Its character record ($8E:B678). */
    character: number | null;
    state: number | null;
    /** Position in tiles, or null when computed (0xA2). */
    x: number | null;
    y: number | null;
    /** 0xC2 places a spawner. */
    spawner: boolean;
    /** How many a spawner makes: the last constant written to $2433 before it. */
    quantity: number | null;
    opcode: number;
    at: number;
}

export interface RoomScript {
    /** Where the packed pointer to the script is (bus). */
    scriptPointerSnes: number;
    rawScriptValue: number;
    scriptAddressSnes: number;
    /** Every instruction control reaches inside the script, in byte order. */
    instructions: ScriptRow[];
    terminated: boolean;
    stopReason: StopReason;
    /** The first instruction, for a one-line preview. */
    label: string;
    /** What it gives, per path (a branch can stage different pickups). */
    loot: LootFacts[];
    /** The pickups as compiler macros, where they can be written exactly. */
    everscript: string[];
    /** Where it sends the player. */
    transitions: TransitionFacts[];
    /** Whom it can place: candidates, since every branch is listed. */
    spawns: SpawnFacts[];
}

export interface RoomTrigger extends RoomScript {
    x1: number; y1: number; x2: number; y2: number;
    scriptId: number;
}

/** Where the tables are, shown as they are so a bad room can be diagnosed. */
export interface RoomScriptMeta {
    /** File offsets of the trigger entries, their byte lengths and counts. */
    stepTableRom: number; stepLength: number; stepCount: number;
    bTableRom: number; bLength: number; bCount: number;
    enterPointerSnes: number;
    enterRawValue: number;
}

export interface RoomScriptModel {
    mapId: number;
    /** The room's data blob. */
    dataPointerSnes: number;
    /** The pointer table trigger ids index. */
    mapscriptTableSnes: number;
    meta: RoomScriptMeta;
    enter: RoomScript;
    stepOn: RoomTrigger[];
    bTrigger: RoomTrigger[];
}

const SPAWNER_QUANTITY = 0x2433;
const hex2 = (v: number): string => '0x' + v.toString(16).padStart(2, '0');

function row(rom: ScriptRom, ins: Instruction, names: Names): ScriptRow {
    const bytes: string[] = [];
    for (let i = 0; i < ins.size; i++) bytes.push(rom.u8(ins.address + i).toString(16).padStart(2, '0').toUpperCase());
    return {
        addressSnes: ins.address, opcode: ins.opcode, opcodeHex: hex2(ins.opcode), size: ins.size, bytesHex: bytes.join(' '),
        summary: text(ins, names), terminal: ins.flow === 'end' || ins.flow === 'reset', untraced: !ins.spec.name,
        unsupported: false, depth: 0,
    };
}

function spawnsOf(list: Instruction[]): SpawnFacts[] {
    const out: SpawnFacts[] = [];
    let quantity: number | null = null;
    for (const ins of list) {
        const f = facts(ins);
        if (f.k === 'write' && f.area === 'save' && f.addr === SPAWNER_QUANTITY) quantity = f.value;
        if (f.k !== 'spawn') continue;
        const n = enemyName(f.index);
        out.push({
            npc: f.index, name: n?.name ?? null, romName: n?.romName ?? null, character: n?.character ?? null, state: ins.opcode === 0xBA || ins.opcode === 0xC2 ? null : f.state,
            x: f.x, y: f.y, spawner: f.spawner, quantity: f.spawner ? quantity : null, opcode: ins.opcode, at: ins.address,
        });
    }
    return out;
}

/** One script: its listing, loot, doors and spawns. `pointer` / `packed` say where it was named. */
export function scriptModel(rom: ScriptRom, entry: number | null, pointer = 0, packed = 0, names: Names = printNames(hiromFileOffset)): RoomScript {
    const empty: RoomScript = {
        scriptPointerSnes: pointer, rawScriptValue: packed, scriptAddressSnes: entry ?? 0, instructions: [], terminated: false,
        stopReason: 'none', label: '', loot: [], everscript: [], transitions: [], spawns: [],
    };
    if (entry === null || !rom.contains(entry)) return empty;
    const w = walk(rom, [entry], false);
    const list = [...w.instructions.values()].sort((a, b) => a.address - b.address);
    const rows = list.map((i) => row(rom, i, names));
    let stopReason: StopReason = 'terminated';
    for (const [at, message] of [...w.errors].sort((a, b) => a[0] - b[0])) {
        stopReason = /opcode/.test(message) ? 'unknown-opcode' : 'bad-operand';
        rows.push({ addressSnes: at, opcode: rom.u8(at), opcodeHex: hex2(rom.u8(at)), size: 1, bytesHex: rom.u8(at).toString(16).padStart(2, '0').toUpperCase(), summary: `// ${message}`, terminal: true, untraced: false, unsupported: true, depth: 0 });
    }
    rows.sort((a, b) => a.addressSnes - b.addressSnes);
    const p = paths(rom, entry).paths;
    // Spawns in the scripts it calls locally too (not by global id: those are shared drivers).
    const local: Instruction[] = [];
    const done = new Set<number>([entry]);
    for (let todo = [...list]; todo.length;) {
        const ins = todo.shift()!;
        local.push(ins);
        const f = facts(ins);
        if (f.k === 'call' && f.global === null && ins.target !== null && !done.has(ins.target) && rom.contains(ins.target)) {
            done.add(ins.target);
            todo.push(...[...walk(rom, [ins.target], false).instructions.values()].sort((x, y) => x.address - y.address));
        }
    }
    const loot = lootOf(p);
    return {
        ...empty, instructions: rows, terminated: stopReason === 'terminated', stopReason, label: rows[0]?.summary ?? '',
        loot, everscript: loot.map(lootToEverscript).filter((s): s is string => s !== null), transitions: doorsOf(p), spawns: spawnsOf(local),
    };
}

/** Everything the editor shows about one room's scripts. */
export function buildRoomScriptModel(bytes: Uint8Array, mapId: number): RoomScriptModel {
    const rom = new ScriptRom(bytes);
    const names = printNames(hiromFileOffset);
    const r = roomScripts(rom, mapId);
    const trigger = (t: (typeof r.triggers)[number]): RoomTrigger => ({
        ...scriptModel(rom, t.script, t.pointer, rom.u24(t.pointer), names), x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, scriptId: t.id,
    });
    return {
        mapId,
        dataPointerSnes: r.blob,
        mapscriptTableSnes: SCRIPT_HEADER + rom.header(0),
        meta: {
            stepTableRom: hiromFileOffset(r.step.at), stepLength: r.step.length, stepCount: r.step.count,
            bTableRom: hiromFileOffset(r.b.at), bLength: r.b.length, bCount: r.b.count,
            enterPointerSnes: r.enterPointer, enterRawValue: r.enterPacked,
        },
        enter: scriptModel(rom, r.enter, r.enterPointer, r.enterPacked, names),
        stepOn: r.triggers.filter((t) => t.kind === 'step').map(trigger),
        bTrigger: r.triggers.filter((t) => t.kind === 'b').map(trigger),
    };
}
