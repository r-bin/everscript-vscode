// Ownership: public API of the script simulation. Pure.
//
// `createSimulator(rom, decoder)` binds a ROM to the instruction decoder (by default script-vm,
// decoder.ts) and returns the entry points.

import { Machine, Decoder } from './machine';
import { vmDecoder } from './decoder';
import { simulate, SimOptions, SimResult } from './explore';
import { analyzeScript, ScriptAnalysis } from './trigger';
import { Pin } from './memory';
import { analyzeRoom, RoomAnalysis } from './room';
import { emitScript, EmittedScript } from './everscript';
import { roomVariants, RoomVariant, SplitOn } from './variants';

export interface Simulator {
    machine: Machine;
    /** Every path a script at `entry` can take. */
    run(entry: number, opts?: SimOptions): SimResult;
    /** A small script (trigger, pickup) told as cases. */
    analyze(entry: number, pins?: readonly Pin[]): ScriptAnalysis;
    /** A room: enter-script scenarios, triggers as cases, clusters. */
    room(mapId: number, pins?: readonly Pin[]): RoomAnalysis;
    /**
     * A room as the variants a player meets: who stands in it, under which story flags.
     * `splitOn` picks the placements whose conditions make a different room (default: all).
     * Reuses `room` when given; else runs the enter script alone.
     */
    variants(mapId: number, opts?: { room?: RoomAnalysis; splitOn?: SplitOn }): RoomVariant[];
    /** A script as a neutral tree and as Everscript that compiles to the same bytes. */
    emit(entry: number, name?: string): EmittedScript;
}

export function createSimulator(rom: Uint8Array, decoder: Decoder = vmDecoder): Simulator {
    const machine = new Machine(rom, decoder);
    return {
        machine,
        run: (entry, opts) => simulate(machine, entry, opts),
        analyze: (entry, pins) => analyzeScript(machine, entry, pins),
        emit: (entry, name) => emitScript(machine, entry, name),
        room: (mapId, pins) => analyzeRoom(machine, mapId, decoder.buildRoomScriptModel(rom, mapId), pins),
        // Only the enter script places characters: the triggers (the slow part) are left out.
        variants: (mapId, opts = {}) => roomVariants(opts.room ?? analyzeRoom(machine, mapId, { ...decoder.buildRoomScriptModel(rom, mapId), stepOn: [], bTrigger: [] }), decoder, opts.splitOn, machine),
    };
}

export { key, ramHex } from './sym';
export { PINS_BETWEEN_PICKUPS, lootOutcome, changes, describeCondition, describeChange } from './understand';
export { segment, splitPrepareExecute } from './segments';
export type { ScriptAnalysis, Case, Condition } from './trigger';
export type { Pin } from './memory';
export type { Part } from './segments';
export type { RoomAnalysis, Scenario, FlagNode, Cluster, RoomTriggerAnalysis } from './room';
export { roomVariants, variantsReport } from './variants';
export type { RoomVariant, VariantSpawn, SplitOn } from './variants';
export { roomReport, roomSummary, roomEverscript } from './report';
export { pathFromMoment } from './snapshot';
export type { GameMoment } from './snapshot';
export type { EmittedScript, Neutral } from './everscript';
export type { Sym } from './sym';
export type { SimResult, SimPath, SimOptions } from './explore';
export type { SimEvent, Step, SimEntity } from './state';
export { freshState, playStep, playableTrigger, holds, triggerOf } from './play';
export type { PlayTrigger, RouteState, StepResult, Verdict } from './play';
