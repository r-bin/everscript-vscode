'use strict';
// Ownership: the Scripts tab's use of the script simulation (../../simulation,
// a library): a script as the Everscript that compiles back to its bytes, and a
// room's triggers grouped into the simulation's clusters (pickups, exits,
// dialog, cutscenes, other). The simulation is work in progress; whatever it
// cannot do comes back as `error` and the tab keeps showing the decoded bytes.
//
// Trigger keys match model/rooms.js: `step:<i>`, `b:<i>`, `enter`.

const simulation = require('../../../../../dist/games/evermore/simulation');

let _sim = null;      // { rom, sim, rooms: Map<id, clusters> }

function simulator(rom) {
    if (!_sim || _sim.rom !== rom) _sim = { rom, sim: simulation.createSimulator(new Uint8Array(rom)), rooms: new Map() };
    return _sim;
}

const NAMES = { enter: 'enter', step: 'step_on', b: 'b_trigger' };

/** { text, structured } or { error }. */
function simulateScript(rom, address, key) {
    try {
        const kind = String(key).split(':')[0];
        const name = (NAMES[kind] || 'script') + (key.includes(':') ? '_' + key.split(':')[1] : '');
        const out = simulator(rom).sim.emit(address, name);
        return { text: out.everscript, structured: out.structured };
    } catch (err) {
        return { error: String(err && err.message || err) };
    }
}

/** [{ kind, title, keys: ['step:3', ...] }] or { error }. Cached per room. */
function roomClusters(rom, id) {
    const s = simulator(rom);
    if (s.rooms.has(id)) return s.rooms.get(id);
    let out;
    try {
        out = s.sim.room(id).clusters.map((c) => ({
            kind: c.kind,
            title: c.title,
            keys: c.triggers.map((t) => (t.type === 'b-button' ? 'b:' : 'step:') + t.index),
        }));
    } catch (err) {
        out = { error: String(err && err.message || err) };
    }
    s.rooms.set(id, out);
    return out;
}

module.exports = { simulateScript, roomClusters };
