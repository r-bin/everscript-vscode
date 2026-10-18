// Ownership: what the vanilla rooms say about one graphic, for the tile sheets — its animation, its
// shape class, the stairs under it, its special flags. Pure reads of the vanilla index.

import * as maps from '../../maps';
import type { VanillaIndex } from '../../maps';

type Layer = 'terrain' | 'canopy';
/** A sheet animation: its frames, the delays of the picked timing, every timing, and which was picked. */
interface SheetAnimation { frames: number[]; delays: number[]; timings: { delays: number[]; channels: number }[]; pick: number }

/** `[kind, frame0, frame]` for a graphic: 1 = an animation's frame 0, 2 = a later frame, 0 = neither. */
function animationOf(index: VanillaIndex, graphic: number): [number, number, number] {
    if (index.animations.byFirst.has(graphic)) return [1, graphic, 0];
    const f = index.animations.frameOf.get(graphic);
    return f ? [2, f.first, f.index] : [0, 0, 0];
}

/**
 * The animations that start among these graphics. `timings` are vanilla's
 * patterns for the cycle in one global order (the Animation tab letters
 * them A, B, C…); `pick` is the one this family's cells run most, else the
 * most-used overall, and `delays` is that pick — what a ▶ swatch places.
 */
function sheetAnimations(index: VanillaIndex, ids: Iterable<number>, family: number): Record<string, SheetAnimation | Record<number, SheetAnimation[]>> {
    const out: Record<string, SheetAnimation | Record<number, SheetAnimation[]>> = {};
    const one = (a: NonNullable<ReturnType<VanillaIndex['animations']['byFirst']['get']>>): SheetAnimation => {
        const timings = (a.timings || []).map((t) => ({ delays: t.delays, channels: t.channels }));
        let pick = 0, best = 0;
        (a.timings || []).forEach((t, i) => {
            const n = (t.families && t.families[family]) || 0;
            if (n > best) { best = n; pick = i; }
        });
        return { frames: a.frames, delays: timings.length ? timings[pick].delays : a.delays, timings, pick };
    };
    for (const g of ids) {
        const a = index.animations.byFirst.get(g);
        // Every other cycle named by this graphic: its timings letter a tile running it (`others`).
        const rest = ((index.animations.cycles && index.animations.cycles.get(g)) || []).filter((c) => c !== a).map(one);
        if (a) out[g] = one(a);
        if (rest.length) {
            const others = (out._others || (out._others = {})) as Record<number, SheetAnimation[]>;
            others[g] = rest;
        }
    }
    return out;
}

/** The collision filter's class of a suggested shape: floor (open or stairs), wall (solid) or edge. */
function shapeClass(index: VanillaIndex, graphic: number, layer: Layer): string | null {
    if (stairsOf(index, graphic, layer)) return 'floor';
    const g = maps.suggestGeometry(index, graphic, layer);
    if (!g) return null;
    return g.value === 0 ? 'floor' : g.value === 0x0f ? 'wall' : 'edge';
}

/** How many of a family's graphics each collision class could list. */
function shapeCounts(index: VanillaIndex, list: { value: number }[]) {
    const out: Record<string, number> = { floor: 0, edge: 0, wall: 0 };
    for (const a of list) {
        const seen = new Set([shapeClass(index, a.value, 'terrain'), shapeClass(index, a.value, 'canopy')]);
        for (const k of Object.keys(out)) if (seen.has(k)) out[k] += 1;
    }
    return out;
}

/** A graphic's stairs direction on one layer, 0 when it is not stairs. */
function stairsOf(index: VanillaIndex, graphic: number, layer: Layer): number {
    const s = maps.suggestStairs(index, graphic, layer);
    return s ? s.nibble : 0;
}

/**
 * Special collision flags: 1=drift, 2=deflect, 4=interact (bit 15), 8=step-on
 * (bit 14, the cells a step-on trigger fires on), with the
 * drift nibble in the high nibble.
 *
 * A flag needs **most** of the graphic's placements on one layer to carry it.
 * Any single placement used to be enough, and a collision word belongs to the
 * cell, not the art: the empty canopy sits over every gated cell and a grass
 * tile was gated somewhere once, so the Tile tab's `deflect` filter listed
 * 643 graphics, blank ones among them. Deflect is the Special tab's pick —
 * gate nibble 1 (map-editor-special.js) — not any bit-8 word, which also
 * takes the boy/dog walls (3, 5, 7).
 */
function specialFlagsOf(index: VanillaIndex, graphicId: number): number {
    let flags = 0, driftDir = 0;
    for (const list of [index.collisions.get(graphicId) || [], index.canopyCollisions.get(graphicId) || []]) {
        let total = 0, drift = 0, deflect = 0, interact = 0, stepOn = 0;
        const dirs: Record<number, number> = {};
        for (const a of list) {
            total += a.uses;
            if ((a.value & 0x2000) && (a.value & 0x0f) >= 8) {
                drift += a.uses;
                dirs[a.value & 0x0f] = (dirs[a.value & 0x0f] || 0) + a.uses;
            }
            if ((a.value & 0x0100) && ((a.value >> 8) & 0x0f) === 1) deflect += a.uses;
            if (a.value & 0x8000) interact += a.uses;
            if (a.value & 0x4000) stepOn += a.uses;
        }
        if (!total) continue;
        if (drift * 2 >= total) {
            flags |= 1;
            driftDir = Number(Object.keys(dirs).sort((x, y) => dirs[Number(y)] - dirs[Number(x)])[0]);
        }
        if (deflect * 2 >= total) flags |= 2;
        if (interact * 2 >= total) flags |= 4;
        if (stepOn * 2 >= total) flags |= 8;
    }
    return ((driftDir & 0x0f) << 4) | (flags & 0x0f);
}

export type { SheetAnimation };
export { animationOf, sheetAnimations, shapeCounts, stairsOf, specialFlagsOf };
