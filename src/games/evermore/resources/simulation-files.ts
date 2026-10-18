// Ownership: `soe://rom/assets/scripts/rooms/<id>/simulation.{md,json}` and
// `decompiled.evs` — a room's scripts simulated (scenarios, flag tree,
// trigger cases, clusters) and written back as byte-identical Everscript.
// Pure apart from the ROM buffer it is handed; one simulator per ROM buffer.

import { text, json } from './nodes';
import type { FileNode } from './nodes';
import type { Simulator, RoomAnalysis } from '../simulation';

const simulators = new WeakMap<Uint8Array, Simulator>();
const rooms = new WeakMap<Uint8Array, Map<number, RoomAnalysis>>();

/** Loaded on first use: the simulation is large and only these files need it. */
function simulation(): typeof import('../simulation') {
    return require('../simulation');
}

function simulatorFor(rom: Uint8Array): Simulator {
    let sim = simulators.get(rom);
    if (!sim) { sim = simulation().createSimulator(rom); simulators.set(rom, sim); }
    return sim;
}

/** Room analyses are the expensive part (up to ~1.5 s); keep one per ROM and room. */
function roomFor(rom: Uint8Array, mapId: number): RoomAnalysis {
    let cache = rooms.get(rom);
    if (!cache) { cache = new Map(); rooms.set(rom, cache); }
    let room = cache.get(mapId);
    if (!room) { room = simulatorFor(rom).room(mapId); cache.set(mapId, room); }
    return room;
}

/** The node for `leaf` in a room's script folder, or null when it is not one of ours. */
function resolveSimulationFile(rom: Uint8Array | null, mapId: number, leaf: string): FileNode | null {
    if (leaf === 'simulation.md') return text(() => rom ? simulation().roomReport(roomFor(rom, mapId)) : '(no ROM available)');
    if (leaf === 'simulation.json') return json(() => rom ? simulation().roomSummary(roomFor(rom, mapId)) : { mapId, error: 'no ROM' });
    if (leaf === 'decompiled.evs') {
        return text(() => {
            if (!rom) return '// no ROM available';
            const sim = simulatorFor(rom);
            return simulation().roomEverscript(roomFor(rom, mapId), (entry: number, name: string) => sim.emit(entry, name));
        });
    }
    return null;
}

const SIMULATION_FILES = ['simulation.md', 'simulation.json', 'decompiled.evs'];

export { resolveSimulationFile, SIMULATION_FILES };
