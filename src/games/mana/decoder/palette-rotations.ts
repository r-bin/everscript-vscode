// Ownership: which colours of an animation trace (animate.ts) rotate — a run of colours
// in one BG palette that shift by one place every `period` frames, the last wrapping
// to the first. Read off the trace, not off the effect bytes: `$02:BAD6` runs the
// effects ($C8:087B, types 0-2 cycle the colours whose ROM word has bit 15), and a
// colour that changes any other way is left in `others`. Pure.

import { AnimationTrace } from './animate';

export interface PaletteRotation {
    palette: number;            // BG palette 0-7
    first: number;              // colour 1-15 in that palette
    count: number;              // colours in the run (2 or more)
    period: number;             // frames between two shifts
    /** +1: each colour takes the one below's value (colours move up); -1: the one above's. */
    direction: 1 | -1;
}

export interface PaletteRotations {
    rotations: PaletteRotation[];
    /** CGRAM indices that change but are not part of a rotation. */
    others: number[];
}

/** The value of every colour at each change, frame 0 of the recording first. */
function colourStates(trace: AnimationTrace): { frames: number[]; states: Uint16Array[] } {
    const frames = [-1], states = [trace.cgram.slice()];
    let now = trace.cgram.slice();
    for (const s of trace.steps) {
        if (!s.colours.size) continue;
        now = now.slice();
        for (const [i, v] of s.colours) now[i] = v;
        frames.push(s.frame); states.push(now);
    }
    return { frames, states };
}

/** The rotation colours lo..hi make over the recording, or null when they do something else. */
function rotationOf(frames: number[], states: Uint16Array[], lo: number, hi: number): Pick<PaletteRotation, 'period' | 'direction'> | null {
    const n = hi - lo + 1;
    const moves: number[] = [];
    let direction = 0;
    for (let k = 1; k < states.length; k++) {
        const a = states[k - 1], b = states[k];
        let same = true;
        for (let i = lo; i <= hi; i++) if (a[i] !== b[i]) { same = false; break; }
        if (same) continue;
        const up = (d: number) => { for (let j = 0; j < n; j++) if (b[lo + j] !== a[lo + (j - d + n) % n]) return false; return true; };
        const d = direction ? (up(direction) ? direction : 0) : up(1) ? 1 : up(-1) ? -1 : 0;
        if (!d) return null;
        direction = d;
        moves.push(frames[k]);
    }
    if (moves.length < 2) return null;
    const period = moves[1] - moves[0];
    if (period <= 0 || moves.some((f, i) => i && f - moves[i - 1] !== period)) return null;
    return { period, direction: direction as 1 | -1 };
}

/** The rotations in `trace`: per palette, the longest runs of changing colours that rotate. */
export function paletteRotations(trace: AnimationTrace): PaletteRotations {
    const { frames, states } = colourStates(trace);
    const rotations: PaletteRotation[] = [], others: number[] = [];
    for (let p = 0; p < 8; p++) {
        let c = 1;
        while (c < 16) {
            if (!trace.colours.has(p * 16 + c)) { c++; continue; }
            let end = c;
            while (end + 1 < 16 && trace.colours.has(p * 16 + end + 1)) end++;
            let hi = end, found: ReturnType<typeof rotationOf> = null;
            for (; hi > c && !(found = rotationOf(frames, states, p * 16 + c, p * 16 + hi)); hi--);
            if (found) {
                rotations.push({ palette: p, first: c, count: hi - c + 1, ...found });
                c = hi + 1;
            } else {
                others.push(p * 16 + c);
                c++;
            }
        }
    }
    return { rotations, others };
}
