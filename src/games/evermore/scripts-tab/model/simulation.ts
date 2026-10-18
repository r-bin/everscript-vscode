// Ownership: the Scripts tab's use of the script simulation (../../simulation,
// a library): a script as the Everscript that compiles back to its bytes, and a
// room's triggers grouped into the simulation's clusters (pickups, exits,
// dialog, cutscenes, other). The simulation is work in progress; whatever it
// cannot do comes back as `error` and the tab keeps showing the decoded bytes.
//
// Trigger keys match model/rooms.ts: `step:<i>`, `b:<i>`, `enter`.

import * as simulation from '../../simulation';

/** A room's triggers grouped by what they do, keyed like model/rooms.ts. */
interface ClusterView { kind: string; title: string; keys: string[] }
type Clusters = ClusterView[] | { error: string };

let _sim: { rom: ArrayLike<number>; sim: simulation.Simulator; rooms: Map<number, Clusters> } | null = null;

const message = (err: unknown): string => String(err instanceof Error ? err.message : err);

function simulator(rom: ArrayLike<number>) {
    if (!_sim || _sim.rom !== rom) _sim = { rom, sim: simulation.createSimulator(new Uint8Array(rom)), rooms: new Map() };
    return _sim;
}

const NAMES: Record<string, string> = { enter: 'enter', step: 'step_on', b: 'b_trigger' };

/** { text, structured } or { error }. */
function simulateScript(rom: ArrayLike<number>, address: number, key: string) {
    try {
        const kind = String(key).split(':')[0];
        const name = (NAMES[kind] || 'script') + (key.includes(':') ? '_' + key.split(':')[1] : '');
        const out = simulator(rom).sim.emit(address, name);
        return { text: out.everscript, structured: out.structured };
    } catch (err) {
        return { error: message(err) };
    }
}

/** [{ kind, title, keys: ['step:3', ...] }] or { error }. Cached per room. */
function roomClusters(rom: ArrayLike<number>, id: number): Clusters {
    const s = simulator(rom);
    const hit = s.rooms.get(id);
    if (hit) return hit;
    let out: Clusters;
    try {
        out = s.sim.room(id).clusters.map((c) => ({
            kind: c.kind,
            title: c.title,
            keys: c.triggers.map((t) => (t.type === 'b-button' ? 'b:' : 'step:') + t.index),
        }));
    } catch (err) {
        out = { error: message(err) };
    }
    s.rooms.set(id, out);
    return out;
}

export { simulateScript, roomClusters };
