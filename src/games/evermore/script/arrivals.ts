// Ownership: where the player arrives in a room, gathered from every script in
// the ROM. Pure.
//
// A room's own scripts say where they *send* you; nothing in a room says where
// you *come in*. So this walks every map's triggers once, collects each
// `CHANGE MAP`, and indexes them by destination. What comes back for a room is
// the set of doors that open into it.
//
// The direction comes from the global script the trigger calls on its way out.
// Those are named in names.json, and the names carry it:
//
//   "Prepare room change? South exit/north entrance outdoor-outdoor?"
//
// which means you leave southwards and walk in at the destination's north
// edge — still heading south.

import { buildRoomScriptModel } from './room-scripts';
import { TransitionFacts } from './transition';

export interface Arrival {
    /** The room this door is in. */
    fromMap: number;
    /** Which of that room's scripts holds it. */
    kind: 'enter' | 'step-on' | 'b-trigger';
    /** Index within that trigger list, or -1 for the enter script. */
    index: number;
    /** Where the player lands, in pixels. */
    x: number;
    y: number;
    /** Landing position in map units (8 px), which is what the map draws in. */
    unitX: number;
    unitY: number;
    /** The direction the player is walking as they arrive, when it is known. */
    direction: 'north' | 'east' | 'south' | 'west' | null;
    /** The global scripts called on the way out, names included. */
    prepares: TransitionFacts['prepares'];
    /** Track the transition starts, if any. */
    music: number | null;
}

const PIXELS_PER_UNIT = 8;

/**
 * Read the walk-in direction out of the prepare script's name.
 *
 * The names describe both ends — "South exit/north entrance" — and the exit
 * word is the one that survives the transition: leaving southwards, you keep
 * walking south into the next room.
 */
const DIRECTIONS: Array<[RegExp, Arrival['direction']]> = [
    [/north exit/i, 'north'],
    [/east exit/i, 'east'],
    [/south exit/i, 'south'],
    [/west exit/i, 'west'],
];

function directionOf(prepares: TransitionFacts['prepares']): Arrival['direction'] {
    for (const p of prepares) {
        for (const [re, dir] of DIRECTIONS) if (re.test(p.name)) return dir;
    }
    return null;
}

export type ArrivalIndex = Map<number, Arrival[]>;

/**
 * Every map change in the ROM, indexed by the room it leads to.
 *
 * `maxMaps` bounds the walk; a map whose scripts cannot be decoded is skipped
 * rather than failing the whole index, because one malformed room should not
 * cost every other room its doors.
 */
export function buildArrivalIndex(rom: Uint8Array, maxMaps = 0x80): ArrivalIndex {
    const index: ArrivalIndex = new Map();
    for (let mapId = 0; mapId < maxMaps; mapId++) {
        let model;
        try { model = buildRoomScriptModel(rom, mapId); } catch { continue; }
        const sources: Array<[Arrival['kind'], number, { transitions?: TransitionFacts[] }]> = [
            ['enter', -1, model.enter],
            ...model.stepOn.map((t, i) => ['step-on', i, t] as [Arrival['kind'], number, typeof t]),
            ...model.bTrigger.map((t, i) => ['b-trigger', i, t] as [Arrival['kind'], number, typeof t]),
        ];
        for (const [kind, i, script] of sources) {
            for (const t of script.transitions || []) {
                const list = index.get(t.mapId) || [];
                list.push({
                    fromMap: mapId,
                    kind,
                    index: i,
                    x: t.x,
                    y: t.y,
                    unitX: Math.round(t.x / PIXELS_PER_UNIT),
                    unitY: Math.round(t.y / PIXELS_PER_UNIT),
                    direction: directionOf(t.prepares),
                    prepares: t.prepares,
                    music: t.music,
                });
                index.set(t.mapId, list);
            }
        }
    }
    return index;
}

/**
 * Collapse doors that land on the same tile from the same room.
 *
 * A wide doorway is several trigger rows leading to one spot, and drawing six
 * markers on one tile says less than drawing one.
 */
export function mergeArrivals(list: readonly Arrival[]): Arrival[] {
    const seen = new Map<string, Arrival>();
    for (const a of list) {
        const key = `${a.fromMap}:${a.unitX}:${a.unitY}:${a.direction}`;
        if (!seen.has(key)) seen.set(key, a);
    }
    return [...seen.values()];
}
