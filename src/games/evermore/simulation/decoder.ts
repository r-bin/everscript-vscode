// Ownership: the simulation's Decoder (machine.ts) on script-vm and script-model: boundaries,
// control flow and placements from the decoder written from the game, names from the model.

import { Expression, Instruction as VmInstruction, ScriptRom, decodeAt, facts, text, unpack } from '../script-vm';
import { buildRoomScriptModel, enemyName, flagName, globalScriptName, lootRewardName, mapName, printNames, scriptName } from '../script-model';
import { Decoder, Effect, Instruction, SpawnFact } from './machine';
import { hiromFileOffset as file } from '../../../platform/snes/hirom';

const TILE = 8;
const RANDOM_SUB_OPS = new Set([0x2A, 0x2B]);
const names = printNames(file);

const roms = new WeakMap<Uint8Array, ScriptRom | null>();
function scriptRom(rom: Uint8Array): ScriptRom | null {
    if (!roms.has(rom)) {
        let sr: ScriptRom | null = null;
        try { sr = new ScriptRom(rom); } catch { sr = null; }
        roms.set(rom, sr);
    }
    return roms.get(rom)!;
}

function expressions(ins: VmInstruction): Expression[] {
    const out: Expression[] = [];
    for (const o of ins.operands) {
        if (o.k === 'E') out.push(o.expr);
        else if (o.k === 'A') out.push(...o.args);
        else if (o.k === 'Z') out.push(...o.list);
    }
    return out;
}

/** What spawn() needs to place an NPC, kept with the instruction. */
const spawns = new WeakMap<Instruction, SpawnFact>();

function adapt(ins: VmInstruction): Instruction {
    const f = facts(ins);
    const effects: Effect[] = [];
    if ((ins.flow === 'branch' || ins.flow === 'jump') && ins.target !== null) effects.push({ kind: 'branch', target: ins.target });
    if (f.k === 'call' && f.global !== null) effects.push({ kind: 'callGlobal', id: f.global });
    else if ((f.k === 'call' || f.k === 'start') && f.target !== null) effects.push({ kind: 'call', target: f.target });
    if (f.k === 'changeMap' && f.map !== null) effects.push({ kind: 'changeMap', mapId: f.map, x: f.x * TILE, y: f.y * TILE });
    if (f.k === 'music') effects.push({ kind: 'playMusic', track: f.index });
    if (expressions(ins).some((e) => e.terms.some((t) => RANDOM_SUB_OPS.has(t.subOp)))) effects.push({ kind: 'random' });
    const out: Instruction = {
        address: ins.address, opcode: ins.opcode, size: ins.size, summary: text(ins, names),
        terminal: ins.flow === 'end' || ins.flow === 'reset', effects,
    };
    if (f.k === 'spawn') {
        effects.push({ kind: 'spawn', npc: f.index });
        const n = enemyName(f.index);
        spawns.set(out, { npc: f.index, name: n?.name ?? null, romName: n?.romName ?? null, x: f.x, y: f.y });
    }
    return out;
}

export const vmDecoder: Decoder = {
    decodeInstruction(rom, addr) {
        const sr = scriptRom(rom);
        if (!sr || !sr.contains(addr)) return null;
        try { return adapt(decodeAt(sr, addr)); } catch { return null; }
    },
    snesToRom: file,
    unpack,
    globalScriptName,
    scriptName,
    flagName,
    lootRewardName,
    mapName,
    spawn: (ins) => spawns.get(ins) ?? null,
    buildRoomScriptModel,
};
