// Ownership: which graphics vanilla animates, and as which frames. Pure.
//
// A Section 2 channel swaps the graphic in one VRAM slot on a timer
// (docs/map-format/map_animated_tiles.md): the map only ever places frame 0,
// and frames 1..n exist only as what the slot turns into. So a torch is one
// thing — frame 0 plus the frames that replace it — and its later frames
// are never drawn on their own. The Tile tab lists an animation once by
// default for exactly that reason.
//
// The same cycle often runs at several phases (compactAnimations); it is
// one animation.

import { RoomData } from './room';

export interface Animation {
    /** Graphic ids, frame 0 first. */
    frames: number[];
    /** How long each frame holds, in 60 Hz ticks. */
    delays: number[];
    /** Rooms animating frame 0 with this sequence. */
    rooms: number;
    /**
     * Every timing vanilla runs this cycle at, in the same rotation as
     * `frames`, most-used first: `delays` per frame and how many channels
     * use them. The Animation tab offers these as presets for this cycle.
     */
    timings?: Array<{ delays: number[]; channels: number }>;
}

export interface AnimationIndex {
    /** Frame-0 graphic -> its animation. */
    byFirst: Map<number, Animation>;
    /** Later-frame graphic -> `{first, index}`: whose frame it is, and which. */
    frameOf: Map<number, { first: number; index: number }>;
}

/** Tally one room's channels into `seen` (frame-0 graphic -> sequence key -> animation). */
export function noteAnimations(room: RoomData, seen: Map<number, Map<string, Animation>>): void {
    for (const ch of room.animation || []) {
        if (ch.frames.length < 2) continue;
        const frames = ch.frames.map((f) => f.tileId);
        const key = frames.join(',');
        let byKey = seen.get(frames[0]);
        if (!byKey) { byKey = new Map(); seen.set(frames[0], byKey); }
        const delays = ch.frames.map((f) => f.delay);
        const had = byKey.get(key);
        if (had) { had.rooms += 1; noteTiming(had, delays, 1); }
        else byKey.set(key, { frames, delays, rooms: 1, timings: [{ delays, channels: 1 }] });
    }
}

function noteTiming(a: Animation, delays: number[], channels: number): void {
    const key = delays.join(',');
    const t = (a.timings || (a.timings = [])).find((x) => x.delays.join(',') === key);
    if (t) t.channels += channels;
    else a.timings.push({ delays: delays.slice(), channels });
}

/** A sequence turned so its lowest graphic comes first: every phase of one cycle gives the same answer. */
function canonical(a: Animation): Animation {
    let at = 0;
    a.frames.forEach((g, i) => { if (g < a.frames[at]) at = i; });
    const turn = <T>(xs: T[]): T[] => xs.slice(at).concat(xs.slice(0, at));
    return {
        frames: turn(a.frames), delays: turn(a.delays), rooms: a.rooms,
        timings: (a.timings || []).map((t) => ({ delays: turn(t.delays), channels: t.channels })),
    };
}

/**
 * One animation per cycle, and the reverse map.
 *
 * Vanilla runs the same cycle in several slots at different phases — the
 * torches in 0x6e flicker out of step — so a channel starting at 2743 and
 * one starting at 2742 are the same flame. They are one animation, named by
 * its lowest graphic (`byFirst`); every other graphic of the cycle is a
 * later frame of it (`frameOf`). A graphic in two different cycles belongs
 * to the one seen in more rooms.
 */
export function compactAnimations(seen: Map<number, Map<string, Animation>>): AnimationIndex {
    const cycles = new Map<string, Animation>();
    for (const byKey of seen.values()) {
        for (const a of byKey.values()) {
            const c = canonical(a);
            const key = c.frames.join(',');
            const had = cycles.get(key);
            if (had) {
                had.rooms += c.rooms;
                (c.timings || []).forEach((t) => noteTiming(had, t.delays, t.channels));
            } else cycles.set(key, c);
        }
    }
    const byFirst = new Map<number, Animation>();
    const frameOf = new Map<number, { first: number; index: number }>();
    const owned = new Set<number>();
    for (const c of cycles.values()) (c.timings || []).sort((a, b) => b.channels - a.channels);
    const list = [...cycles.values()].sort((a, b) => b.rooms - a.rooms || a.frames[0] - b.frames[0]);
    for (const c of list) {
        if (c.frames.some((g) => owned.has(g))) continue;
        c.frames.forEach((g) => owned.add(g));
        byFirst.set(c.frames[0], c);
        c.frames.forEach((g, i) => {
            if (g !== c.frames[0] && !frameOf.has(g)) frameOf.set(g, { first: c.frames[0], index: i });
        });
    }
    return { byFirst, frameOf };
}
