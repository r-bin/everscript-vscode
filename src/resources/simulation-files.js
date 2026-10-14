'use strict';
// Ownership: `soe://rom/assets/scripts/rooms/<id>/simulation.{md,json}` and
// `decompiled.evs` — a room's scripts simulated (scenarios, flag tree,
// trigger cases, clusters) and written back as byte-identical Everscript.
// Pure apart from the ROM buffer it is handed; one simulator per ROM buffer.

const { text, json } = require('./nodes');

const simulators = new WeakMap();
const rooms = new WeakMap();

function simulation() {
    return require('../simulation');
}

function simulatorFor(rom) {
    if (!simulators.has(rom)) simulators.set(rom, simulation().createSimulator(rom));
    return simulators.get(rom);
}

/** Room analyses are the expensive part (up to ~1.5 s); keep one per ROM and room. */
function roomFor(rom, mapId) {
    if (!rooms.has(rom)) rooms.set(rom, new Map());
    const cache = rooms.get(rom);
    if (!cache.has(mapId)) cache.set(mapId, simulatorFor(rom).room(mapId));
    return cache.get(mapId);
}

/** The node for `leaf` in a room's script folder, or null when it is not one of ours. */
function resolveSimulationFile(rom, mapId, leaf) {
    if (leaf === 'simulation.md') return text(() => rom ? simulation().roomReport(roomFor(rom, mapId)) : '(no ROM available)');
    if (leaf === 'simulation.json') return json(() => rom ? simulation().roomSummary(roomFor(rom, mapId)) : { mapId, error: 'no ROM' });
    if (leaf === 'decompiled.evs') {
        return text(() => {
            if (!rom) return '// no ROM available';
            const sim = simulatorFor(rom);
            return simulation().roomEverscript(roomFor(rom, mapId), (entry, name) => sim.emit(entry, name));
        });
    }
    return null;
}

const SIMULATION_FILES = ['simulation.md', 'simulation.json', 'decompiled.evs'];

module.exports = { resolveSimulationFile, SIMULATION_FILES };
