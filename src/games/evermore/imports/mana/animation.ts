// Ownership: a Mana map's animation (games/mana/decoder animate.ts, palette-rotations.ts)
// in Evermore's two kinds (docs/mana/evermore-rooms.md, "Animation"). Pure.
//
//   Mana colour rotation          -> palette-cycle descriptor [b0, b1, b2] ($90D50F,
//                                    ticked by $90D58C: rate = frames per shift, sign = way)
//   Mana metatile whose chars move -> Section 2 channel: its 16x16 states in one loop, a
//                                    delay per state (frames); equal loops share a channel

import { flipH, flipV, keyOf } from '../common/pixels';
import { MAX_GRAPHICS, MAX_IMAGE_GRAPHICS } from '../common/ids';
import type { ManaMap, AnimationTrace, PaletteRotation } from '../../../mana/decoder';

type Layer = 'A' | 'B';
type Draw = (layer: Layer, n: number, vram: Uint8Array) => Uint8Array;
type Placed = { slot: number; h: number; v: number };
/** A converted metatile: its frame-0 pixels and palette, and where Block 1 has it (slot -1: it moves). */
type Tile = { m: { px: Uint8Array; palette: number }; g: Placed };
type Graphics = { slots: { length: number }; place(px: Uint8Array): Placed };

/** Evermore runs two cycles per palette: state slots palette*2 and palette*2+1 ($90D50F). */
const CYCLES_PER_PALETTE = 2;
const MAX_RATE = 0x7F, MAX_DELAY = 0xFF;

/**
 * Palette-cycle descriptors for `rotations`; `slotOf(p)` is the Evermore palette slot Mana
 * palette `p` became (0 when the map draws nothing in it). Mana's +1 (each colour takes the
 * one below's value) is Evermore's positive rate: CGRAM[start+j] = colour (j - shift) mod span.
 */
function paletteCycles(rotations: PaletteRotation[], slotOf: (p: number) => number) {
    const records: number[][] = [], perSlot = new Map<number, number>();
    let dropped = 0;
    for (const r of rotations) {
        const slot = slotOf(r.palette);
        if (!slot) continue;
        const n = perSlot.get(slot) ?? 0;
        if (n >= CYCLES_PER_PALETTE || r.period > MAX_RATE) { dropped++; continue; }
        perSlot.set(slot, n + 1);
        records.push([(slot << 4) | r.first, r.count, (r.direction * r.period) & 0xFF]);
    }
    return { records, dropped };
}

/** Metatiles of each layer the map shows whose characters the trace changes. */
function animatedMetatiles(map: ManaMap, trace: AnimationTrace): Record<Layer, Set<number>> {
    const out: Record<Layer, Set<number>> = { A: new Set(), B: new Set() };
    for (const [layer, table] of [['A', map.tableA], ['B', map.tableB]] as const) {
        for (let n = 0; n < 192; n++) {
            for (let q = 0; q < 4; q++) if (trace.chars.has(table[n * 4 + q] & 0x3FF)) { out[layer].add(n); break; }
        }
    }
    return out;
}

/** Smallest period that repeats over the recording (at least twice), or 0. */
function periodOf(states: Int32Array): number {
    const L = states.length;
    for (let p = 1; p * 2 <= L; p++) {
        let ok = true;
        for (let f = 0; f + p < L && ok; f++) ok = states[f] === states[f + p];
        if (ok) return p;
    }
    return 0;
}

/**
 * One loop as (state, frames) runs, in the order Evermore plays them so the channel stays on
 * the recording's clock: at load the engine shows frame 0 for one frame, then frame 1 for its
 * delay, and so on (`$90:A0F8` starts timer and index at 0). So frame 1 starts at recording
 * frame 1, and frame 0 is the run that holds frame 0 (also the loop's last frames). Every
 * channel is cut at the same moment, which keeps Mana's phase between them.
 */
function loopRuns(states: Int32Array, period: number): Array<[number, number]> {
    const runs: Array<[number, number]> = [];
    for (let f = 1; f <= period; f++) {
        const s = states[f % period], last = runs[runs.length - 1];
        if (last && last[0] === s && last[1] < MAX_DELAY) last[1]++;
        else runs.push([s, 1]);
    }
    const tail = runs.pop()!;                               // the run through frame `period`, which is frame 0
    return [tail, ...runs];
}

/**
 * Section 2 channels for the animated metatiles in `tiles`, drawn by `draw` at each moment of
 * the trace. `frames` are the pixel blocks the channels name; `of` gives each tile ('A:n')
 * its channel and the flips that make it. A tile whose states never repeat within the
 * recording loops the whole recording (`aperiodic`).
 */
function tileChannels(map: ManaMap, trace: AnimationTrace, tiles: Array<[Layer, number]>, draw: Draw) {
    const L = trace.length, vram = trace.vram.slice();
    const tables = { A: map.tableA, B: map.tableB };
    const keys = new Map<string, number>(), pixels: Uint8Array[] = [];
    const stateOf = (px: Uint8Array) => {
        const k = keyOf(px);
        let s = keys.get(k);
        if (s === undefined) { s = pixels.length; keys.set(k, s); pixels.push(px); }
        return s;
    };
    const timeline = tiles.map(([layer, n]) => {
        const chars = new Set([0, 1, 2, 3].map((q) => tables[layer][n * 4 + q] & 0x3FF));
        return { layer, n, chars, states: new Int32Array(L).fill(-1), now: stateOf(draw(layer, n, vram)) };
    });
    let f = 0;
    for (const step of [...trace.steps, { frame: L, chars: new Map<number, Uint8Array>() }]) {
        for (; f < step.frame && f < L; f++) for (const t of timeline) t.states[f] = t.now;
        if (!step.chars.size) continue;
        for (const [c, d] of step.chars) vram.set(d, c * 32);
        for (const t of timeline) {
            if ([...step.chars.keys()].some((c) => t.chars.has(c))) t.now = stateOf(draw(t.layer, t.n, vram));
        }
    }
    const frames: Uint8Array[] = [], frameIndex = new Map<string, number>();
    const frameOf = (px: Uint8Array) => {
        const k = keyOf(px);
        let i = frameIndex.get(k);
        if (i === undefined) { i = frames.length; frameIndex.set(k, i); frames.push(px); }
        return i;
    };
    const channels: { frames: number[]; delays: number[] }[] = [], channelIndex = new Map<string, number>();
    const of = new Map<string, { channel: number; h: number; v: number }>();
    let aperiodic = 0;
    for (const t of timeline) {
        const period = periodOf(t.states) || (aperiodic++, L);
        const runs = loopRuns(t.states, period);
        if (new Set(runs.map((r) => r[0])).size < 2) continue;
        const delays = runs.map((r) => r[1]);
        const seq = runs.map((r) => pixels[r[0]]);
        const tries: [Uint8Array[], number, number][] = [[seq, 0, 0], [seq.map(flipH), 1, 0], [seq.map(flipV), 0, 1], [seq.map((p) => flipV(flipH(p))), 1, 1]];
        let hit: { channel: number; h: number; v: number } | null = null;
        for (const [s, h, v] of tries) {
            const ch = channelIndex.get(s.map(keyOf).join('|') + '|' + delays.join(','));
            if (ch !== undefined) { hit = { channel: ch, h, v }; break; }
        }
        if (!hit) {
            hit = { channel: channels.length, h: 0, v: 0 };
            channelIndex.set(seq.map(keyOf).join('|') + '|' + delays.join(','), channels.length);
            channels.push({ frames: seq.map(frameOf), delays });
        }
        of.set(t.layer + ':' + t.n, hit);
    }
    return { frames, channels, of, aperiodic };
}

/**
 * The moving metatiles (slot -1 in `tiles`) as Section 2 channels, `draw` drawing one in a
 * palette at a moment of the trace. Their slots follow Block 1 (map_animated_tiles.md §4);
 * when Block 1 and the channels pass what a word can name, or Block 1 and the frames what the
 * image holds, the last channels stop and their tiles show frame 0 from Block 1 (`still`).
 */
function animateTiles(map: ManaMap, trace: AnimationTrace | null, tiles: Record<Layer, Map<number, Tile>>, graphics: Graphics,
    draw: (layer: Layer, n: number, vram: Uint8Array, palette: number) => Uint8Array) {
    const moving: Array<[Layer, number]> = [];
    for (const layer of ['A', 'B'] as Layer[]) for (const [n, t] of tiles[layer]) if (t.g.slot < 0) moving.push([layer, n]);
    const res = trace && moving.length
        ? tileChannels(map, trace, moving, (layer, n, vram) => draw(layer, n, vram, tiles[layer].get(n)!.m.palette))
        : { frames: [], channels: [], of: new Map<string, Placed & { channel: number }>(), aperiodic: 0 };
    let kept = res.channels.length, still = 0;
    const settle = () => {
        for (const [layer, n] of moving) {
            const t = tiles[layer].get(n)!, a = res.of.get(layer + ':' + n);
            if (t.g.slot < 0 && (!a || a.channel >= kept)) { t.g = graphics.place(t.m.px); still++; }
        }
    };
    const frameCount = () => new Set(res.channels.slice(0, kept).flatMap((c) => c.frames)).size;
    settle();
    while (kept && (graphics.slots.length + kept > MAX_GRAPHICS || graphics.slots.length + frameCount() > MAX_IMAGE_GRAPHICS)) { kept--; settle(); }
    for (const [layer, n] of moving) {
        const t = tiles[layer].get(n)!, a = res.of.get(layer + ':' + n);
        if (t.g.slot < 0 && a) t.g = { slot: graphics.slots.length + a.channel, h: a.h, v: a.v };
    }
    const channels = res.channels.slice(0, kept);
    // The engine uploads at most 10 changed channels a frame ($90:A1B4); the rest show late.
    const uploads = new Map<number, number>();
    for (const c of channels) {
        const period = c.delays.reduce((a, b) => a + b, 0);
        for (let t = 1, k = 1; t <= (trace ? trace.length : 0); k = (k + 1) % c.delays.length) {
            uploads.set(t, (uploads.get(t) ?? 0) + 1);
            t += c.delays[k] || period;
        }
    }
    const usedFrames = [...new Set(channels.flatMap((c) => c.frames))].sort((x, y) => x - y);
    const renumber = new Map(usedFrames.map((f, i) => [f, i]));
    return {
        frames: usedFrames.map((f) => res.frames[f]),
        channels: channels.map((c) => ({ frames: c.frames.map((f) => renumber.get(f)!), delays: c.delays })),
        aperiodic: res.aperiodic, still, peakUploads: Math.max(0, ...uploads.values()),
    };
}

export { paletteCycles, animatedMetatiles, animateTiles };
