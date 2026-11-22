// Ownership: a Terranigma room's palette animation in Evermore's terms (docs/terra/evermore-rooms.md "Animation"):
// the colours the room's palette helpers show first, and the helpers that rotate a run of colours as Evermore
// palette cycles (common/cycles.ts). Pure.
//
// Terranigma: the room's helpers and their frames are games/terra/decoder animation.ts (docs/terra/README.md §3.10).
// A helper that writes whole palettes in turn (brightness, a sky) has no Evermore counterpart: its first frame stays.

import * as terra from '../../../terra/decoder';
import type { Rotation } from '../common/cycles';

/**
 * The rotations helper `frames` (one loop, in order) show: the colours that change, split into the longest runs of
 * one palette (two colours at least) that each shift by one place the same way every frame, the last frame back to
 * the first too, every frame held as long (`+1`: each colour takes the value of the one below). Param `$2A` is two
 * 4-colour runs side by side. `rest`: changing colours in no such run (a brightness pulse, a ping-pong), left still.
 */
function rotationsOf(frames: terra.PaletteFrame[]): { rotations: Rotation[]; rest: number } {
    if (frames.length < 2 || frames.some((f) => f.hold !== frames[0].hold)) return { rotations: [], rest: frames.length > 1 ? 1 : 0 };
    const states: Map<number, number>[] = [];
    let state = new Map<number, number>();
    for (const f of frames.concat(frames)) {          // twice: the second loop starts from the first's end
        state = new Map(state);
        f.colours.forEach((c, k) => state.set(f.first + k, c));
        states.push(state);
    }
    const loop = states.slice(frames.length);
    const changed = new Set([...loop[0].keys()].filter((i) => loop.some((s) => s.get(i) !== loop[0].get(i))));
    const turns = (first: number, count: number, direction: number) => loop.every((cur, t) => {
        const next = loop[(t + 1) % loop.length];
        for (let j = 0; j < count; j++) if (next.get(first + j) !== cur.get(first + ((j - direction + count) % count))) return false;
        return true;
    });
    const rotations: Rotation[] = [];
    let rest = 0;
    for (const s of [...changed].sort((a, b) => a - b)) {
        if (!changed.has(s)) continue;
        let len = 0;
        while (changed.has(s + len) && ((s + len) >> 4) === (s >> 4)) len++;
        let found = false;
        for (let count = len; count >= 2 && !found; count--) {
            for (const direction of [1, -1]) {
                if (!turns(s, count, direction)) continue;
                rotations.push({ palette: s >> 4, first: s & 15, count, period: frames[0].hold, direction });
                for (let k = 0; k < count; k++) changed.delete(s + k);
                found = true;
                break;
            }
        }
        if (!found) { changed.delete(s); rest++; }
    }
    return { rotations, rest: rest ? 1 : 0 };
}

/**
 * The room's palette animation: `rotations` what its helpers rotate (Evermore's cycles), `still` the helpers with
 * colours that change otherwise (shown at their first frame), `tiles` the character helpers (not converted), `someStates` the helpers only some
 * story states start (left out). Only helpers every path through the room's list starts count; of two that write the
 * same colours, the first. Their first frames are in the decoder's room palette already (`loadRoom`).
 */
function paletteAnimation(rom: Uint8Array, id: number) {
    const written = new Set<number>(), rotations: Rotation[] = [];
    let still = 0, tiles = 0, someStates = 0;
    for (const h of terra.roomHelpers(rom, id)) {
        // A helper only some story states start (behind an `$FA` branch) belongs to a picture other than the loader's.
        if (!h.always) { someStates++; continue; }
        if (h.script === terra.TILE_HELPER) { tiles++; continue; }
        if (h.script !== terra.PALETTE_HELPER) continue;
        const frames = terra.paletteFrames(rom, h.param);
        if (!frames.length) continue;
        const fresh = frames[0].colours.map((_, k) => frames[0].first + k).filter((i) => i && !written.has(i));
        fresh.forEach((i) => written.add(i));
        if (!fresh.length) continue;
        const r = rotationsOf(frames);
        rotations.push(...r.rotations);
        still += r.rest;
    }
    const rotating = new Set(rotations.flatMap((r) => Array.from({ length: r.count }, (_, k) => r.palette * 16 + r.first + k)));
    return { rotations, rotating, still, tiles, someStates };
}

export { paletteAnimation, rotationsOf };
