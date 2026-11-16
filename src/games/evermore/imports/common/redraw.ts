// Ownership: a converted room's cells redrawn with fewer graphics, pixel for pixel the same picture, before anything is
// approximated (graphics.ts fitGraphics) — for every game a room is converted from (imports/mana, imports/terra). Pure.
//
// Evermore names at most 256 graphics a room (budget.ts). Two ways to drop one without changing a pixel:
// - a colour twin: another graphic draws the same colours in another palette (or flipped): the graphics list keeps
//   graphics apart by palette index, so the same picture in two palettes is two graphics;
// - a stack: the cell's picture is one graphic on layer 1 over another on layer 2, at the cell's priority. Only where
//   moving a pixel between the two layers changes nothing else (the caller says so: `stack`).
// A colour that cycles must stay the same palette index: there a twin is the same index of the same palette.

import { flipH, flipV } from './pixels';
import { fitGraphics } from './graphics';
import { MAX_GRAPHICS } from './ids';

/** A graphic as a cell's word draws it: slot, flips, palette (the caller's number), priority. */
type Ref = { slot: number; h: number; v: number; palette: number; priority: number };
/** A cell's two layers (null: nothing on it), and how many cells show this pair. */
type Pair = { top: Ref | null; bottom: Ref | null; count: number };

const TRANSPARENT = -1;

/**
 * Remove graphics from `slots` until at most `max` remain (or no more can go), rewriting `pairs` in place.
 * `colour(palette, index)`: BGR555; `moving(palette, index)`: in a palette cycle; `palettes`: those a word may name;
 * `keep`: slots never removed. The rarest graphics are tried first. Returns the slots removed.
 */
function redrawWithFewer(slots: Uint8Array[], pairs: Pair[], o: {
    colour: (palette: number, index: number) => number; moving: (palette: number, index: number) => boolean;
    palettes: number[]; keep: ReadonlySet<number>; stack: boolean; max: number;
}): { removed: Set<number>; twins: number; stacks: number } {
    const removed = new Set<number>();
    let twins = 0, stacks = 0;
    if (slots.length <= o.max) return { removed, twins, stacks };

    // Each graphic drawn: per pixel its colour, TRANSPARENT, or (a cycling colour) a code unique to palette and index.
    const flips = slots.map((px) => [px, flipH(px), flipV(px), flipV(flipH(px))]);
    const cache = new Map<number, Int32Array>();
    const draw = (slot: number, f: number, palette: number): Int32Array => {
        const k = (slot * 4 + f) * 16 + palette;
        let d = cache.get(k);
        if (!d) {
            const px = flips[slot][f];
            d = new Int32Array(256);
            for (let i = 0; i < 256; i++) {
                const c = px[i];
                d[i] = !c ? TRANSPARENT : o.moving(palette, c) ? -2 - (palette * 16 + c) : o.colour(palette, c) & 0x7FFF;
            }
            cache.set(k, d);
        }
        return d;
    };
    const flipOf = (r: Ref) => r.h | (r.v << 1);
    const variants: [number, number, number][] = [];
    for (let s = 0; s < slots.length; s++) for (let f = 0; f < 4; f++) for (const p of o.palettes) variants.push([s, f, p]);
    const key = (d: Int32Array) => {
        let a = 0x811C9DC5, b = 0x01000193;
        for (let i = 0; i < 256; i++) { a = Math.imul(a ^ d[i], 0x01000193); b = Math.imul(b + d[i], 0x5BD1E995) ^ (b >>> 13); }
        return (a >>> 0).toString(36) + ':' + (b >>> 0).toString(36);
    };
    const same = (x: Int32Array, y: Int32Array) => { for (let i = 0; i < 256; i++) if (x[i] !== y[i]) return false; return true; };
    // Colour twins by picture: every (slot, flip, palette) drawing it.
    const byPicture = new Map<string, [number, number, number][]>();
    for (const v of variants) {
        const k = key(draw(...v));
        if (!byPicture.has(k)) byPicture.set(k, []);
        byPicture.get(k)!.push(v);
    }
    const usable = (s: number, avoid: number) => s !== avoid && !removed.has(s);
    const asRef = ([slot, f, palette]: [number, number, number], priority: number): Ref => ({ slot, h: f & 1, v: f >> 1, palette, priority });

    const twinOf = (r: Ref, avoid: number): Ref | null => {
        const d = draw(r.slot, flipOf(r), r.palette);
        for (const v of byPicture.get(key(d)) ?? []) if (usable(v[0], avoid) && same(draw(...v), d)) return asRef(v, r.priority);
        return null;
    };
    // Layer-2 candidates by the colour they draw at one pixel, built per pixel when first asked.
    const byPixel: (Map<number, [number, number, number][]> | undefined)[] = [];
    const drawingAt = (i: number, c: number) => {
        let m = byPixel[i];
        if (!m) {
            m = new Map();
            for (const v of variants) { const k = draw(...v)[i]; if (!m.has(k)) m.set(k, []); m.get(k)!.push(v); }
            byPixel[i] = m;
        }
        return m.get(c) ?? [];
    };
    /**
     * `pair`'s picture drawn by graphics other than `avoid`: one on layer 2 alone, else T on layer 1 over U on layer 2.
     * Both at the pair's priority.
     */
    const stackOf = (pair: Pair, avoid: number): [Ref | null, Ref] | null => {
        const t = pair.top ? draw(pair.top.slot, flipOf(pair.top), pair.top.palette) : null;
        const b = pair.bottom ? draw(pair.bottom.slot, flipOf(pair.bottom), pair.bottom.palette) : null;
        const want = new Int32Array(256);
        for (let i = 0; i < 256; i++) want[i] = t && t[i] !== TRANSPARENT ? t[i] : b ? b[i] : TRANSPARENT;
        const priority = (pair.top ?? pair.bottom)!.priority;
        for (const v of byPicture.get(key(want)) ?? []) if (usable(v[0], avoid) && same(draw(...v), want)) return [null, asRef(v, priority)];
        for (const tv of variants) {
            if (!usable(tv[0], avoid)) continue;
            const top = draw(...tv);
            let ok = true, hole = -1;
            for (let i = 0; i < 256 && ok; i++) {
                if (top[i] === TRANSPARENT) { if (hole < 0) hole = i; }
                else if (top[i] !== want[i]) ok = false;
            }
            if (!ok || hole < 0 || top.every((c) => c === TRANSPARENT)) continue;
            for (const uv of drawingAt(hole, want[hole])) {
                if (!usable(uv[0], avoid)) continue;
                const under = draw(...uv);
                let fits = true;
                for (let i = hole; i < 256 && fits; i++) if (top[i] === TRANSPARENT && under[i] !== want[i]) fits = false;
                if (fits) return [asRef(tv, priority), asRef(uv, priority)];
            }
        }
        return null;
    };

    // Who shows each graphic now: [pair, layer].
    const users: [number, 'top' | 'bottom'][][] = slots.map(() => []);
    const index = () => {
        users.forEach((u) => (u.length = 0));
        pairs.forEach((p, k) => { if (p.top) users[p.top.slot].push([k, 'top']); if (p.bottom) users[p.bottom.slot].push([k, 'bottom']); });
    };
    index();
    const shown = (s: number) => users[s].reduce((n, [k]) => n + pairs[k].count, 0);
    const order = slots.map((_, s) => s).filter((s) => !o.keep.has(s)).sort((a, b) => shown(a) - shown(b));
    for (const s of order) {
        if (slots.length - removed.size <= o.max) break;
        // Every cell showing `s` gets another drawing, decided before any is applied.
        const plan: [number, Ref | null, Ref | null, boolean][] = [];
        let failed = false;
        for (const k of new Set(users[s].map(([j]) => j))) {
            const pair = pairs[k];
            const swap = (r: Ref | null) => (r && r.slot === s ? twinOf(r, s) : r);
            const top = swap(pair.top), bottom = swap(pair.bottom);
            if ((!pair.top || top) && (!pair.bottom || bottom)) { plan.push([k, top, bottom, false]); continue; }
            const st = o.stack && !(pair.top && pair.bottom && pair.top.priority !== pair.bottom.priority) ? stackOf(pair, s) : null;
            if (!st) { failed = true; break; }
            plan.push([k, st[0], st[1], true]);
        }
        if (failed) continue;
        for (const [k, top, bottom, stacked] of plan) {
            pairs[k].top = top; pairs[k].bottom = bottom;
            if (stacked) stacks += pairs[k].count; else twins += pairs[k].count;
        }
        removed.add(s);
        index();
    }
    return { removed, twins, stacks };
}

type Options = {
    colour: (palette: number, index: number) => number; moving: (palette: number, index: number) => boolean;
    palettes: number[]; keep: ReadonlySet<number>; stack: boolean;
};

/**
 * `slots` cut down to Evermore's 256 for the cells `pairs`: first redrawn with fewer graphics, the same picture
 * (redrawWithFewer), then those with the nearest twin drawn as it (graphics.ts fitGraphics, weighed by the cells).
 * `pairs`' refs are rewritten in place to the new list. Counts: graphics redrawn, cells drawn by a colour twin or a
 * stack, graphics approximated.
 */
function fitCells(slots: Uint8Array[], pairs: Pair[], o: Options) {
    const again = redrawWithFewer(slots, pairs, { ...o, max: MAX_GRAPHICS });
    const compact: number[] = [], left: Uint8Array[] = [];
    slots.forEach((px, s) => { if (!again.removed.has(s)) { compact[s] = left.length; left.push(px); } });
    const weight: number[] = [], drawnIn: number[] = [];
    for (const p of pairs) for (const r of [p.top, p.bottom]) {
        if (!r) continue;
        const s = compact[r.slot];
        if ((weight[s] ?? 0) < p.count) drawnIn[s] = r.palette;
        weight[s] = (weight[s] ?? 0) + p.count;
    }
    const paletteOf = (s: number) => drawnIn[s] ?? o.palettes[0] ?? 0;
    const fit = fitGraphics(left, weight, (s, k) => o.colour(paletteOf(s), k), new Set([...o.keep].map((s) => compact[s])),
        (s, k) => o.moving(paletteOf(s), k));
    const moved = new Set<Ref>();
    for (const p of pairs) for (const r of [p.top, p.bottom]) {
        if (!r || moved.has(r)) continue;
        const m = fit.remap[compact[r.slot]];
        Object.assign(r, { slot: m.slot, h: r.h ^ m.h, v: r.v ^ m.v });
        moved.add(r);
    }
    return { slots: fit.slots, redrawn: again.removed.size, twins: again.twins, stacks: again.stacks, substituted: fit.removed };
}

export type { Ref, Pair };
export { redrawWithFewer, fitCells };
