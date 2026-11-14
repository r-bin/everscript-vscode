// Ownership: Evermore's 16x16 graphics as a converted room (imports/mana, imports/terra) builds
// them — the graphic layout, the tilemap word's character field for a Block 1 slot, and the
// graphics list (deduplicated, mirrored copies sharing a slot). Pure; game-neutral.

import { MAX_GRAPHICS } from './ids';
import { flipH, flipV, keyOf } from './pixels';

type Placed = { slot: number; h: number; v: number };

const EMPTY_GRAPHIC = 0;        // slot 0 is always the fully transparent graphic

/** Evermore's 16x16 graphic layout: four 8x8 4bpp planar characters, TL TR BL BR. */
function encodeGraphic(px: Uint8Array): Uint8Array {
    const out = new Uint8Array(128);
    for (let s = 0; s < 4; s++) {
        const ox = (s & 1) * 8, oy = (s >> 1) * 8;
        for (let row = 0; row < 8; row++) {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
            for (let col = 0; col < 8; col++) {
                const c = px[(oy + row) * 16 + ox + col], m = 1 << (7 - col);
                if (c & 1) b0 |= m; if (c & 2) b1 |= m; if (c & 4) b2 |= m; if (c & 8) b3 |= m;
            }
            out[s * 32 + row * 2] = b0; out[s * 32 + row * 2 + 1] = b1;
            out[s * 32 + row * 2 + 16] = b2; out[s * 32 + row * 2 + 17] = b3;
        }
    }
    return out;
}

/** Block 1 slot -> character index of a tilemap word (the inverse of `floor(chr/0x20)*8 + floor(chr%0x20/2)`). */
const slotChr = (slot: number): number => Math.floor(slot / 8) * 0x20 + (slot % 8) * 2;

/**
 * The graphics list: deduplicated, mirrored copies sharing one slot. Past `max` (default MAX_GRAPHICS) a new block is
 * drawn empty (`droppedGraphics`); a caller that wants every block listed first passes `max: Infinity` and then
 * `fitGraphics`.
 */
function graphicTable(stats: { droppedGraphics: number }, opts: { max?: number } = {}) {
    const max = opts.max ?? MAX_GRAPHICS;
    const slots: Uint8Array[] = [new Uint8Array(256)], index = new Map<string, number>([[keyOf(slots[0]), 0]]);
    return {
        slots,
        /** {slot, h, v} for a pixel block, adding it when it is new. */
        place(px: Uint8Array): Placed {
            const tries: [Uint8Array, number, number][] = [[px, 0, 0], [flipH(px), 1, 0], [flipV(px), 0, 1], [flipV(flipH(px)), 1, 1]];
            for (const [p, h, v] of tries) {
                const s = index.get(keyOf(p));
                if (s !== undefined) return { slot: s, h, v };
            }
            if (slots.length >= max) { stats.droppedGraphics++; return { slot: EMPTY_GRAPHIC, h: 0, v: 0 }; }
            index.set(keyOf(px), slots.length);
            slots.push(px);
            return { slot: slots.length - 1, h: 0, v: 0 };
        },
    };
}

/** What a transparent pixel against an opaque one costs: as much as the two most distant colours. */
const HOLE = 3 * 31 * 31;

/**
 * `slots` cut down to MAX_GRAPHICS: the graphics removed are those whose closest remaining graphic (any mirror image)
 * looks least different — summed colour distance with each slot's own colours (`colour(slot, index)`: BGR555, the
 * colours it is drawn in), times `weight[slot]` (the cells that show it) — so a graphic with a near twin goes before
 * a one-off (a sign, a door). A removed graphic is drawn as that twin. `keep`: slots never removed (the empty one).
 * Returns the new list and, for every old slot, where it is drawn now.
 */
function fitGraphics(slots: Uint8Array[], weight: number[], colour: (slot: number, index: number) => number, keep: ReadonlySet<number>) {
    const n = slots.length, remove = n - MAX_GRAPHICS;
    const ident = slots.map((_, s): Placed => ({ slot: s, h: 0, v: 0 }));
    if (remove <= 0) return { slots, remap: ident, removed: 0 };
    const alive = new Array(n).fill(true);
    const mirrors = slots.map((px) => [[px, 0, 0], [flipH(px), 1, 0], [flipV(px), 0, 1], [flipV(flipH(px)), 1, 1]] as [Uint8Array, number, number][]);
    const rgb = (c: number) => [c & 31, (c >> 5) & 31, (c >> 10) & 31];
    const best: ({ to: Placed; cost: number } | null)[] = new Array(n).fill(null);
    const nearestOf = (s: number) => {
        const a = slots[s], ca = Array.from(a, (k) => (k ? rgb(colour(s, k)) : null));
        let to: Placed = { slot: 0, h: 0, v: 0 }, cost = Infinity;
        for (let t = 1; t < n; t++) {
            if (t === s || !alive[t]) continue;
            for (const [b, h, v] of mirrors[t]) {
                let d = 0;
                for (let i = 0; i < 256 && d < cost; i++) {
                    if (a[i] === b[i]) continue;
                    const x = ca[i];
                    if (!x || !b[i]) { d += HOLE; continue; }
                    const y = rgb(colour(s, b[i]));
                    d += (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
                }
                if (d < cost) { cost = d; to = { slot: t, h, v }; }
            }
        }
        return { to, cost: cost * Math.max(1, weight[s]) };
    };
    for (let s = 0; s < n; s++) if (!keep.has(s)) best[s] = nearestOf(s);
    const via: (Placed | null)[] = new Array(n).fill(null);
    for (let k = 0; k < remove; k++) {
        let pick = -1;
        for (let s = 0; s < n; s++) {
            if (!alive[s] || keep.has(s)) continue;
            if (!alive[best[s]!.to.slot]) best[s] = nearestOf(s);
            if (pick < 0 || best[s]!.cost < best[pick]!.cost) pick = s;
        }
        if (pick < 0) break;
        alive[pick] = false;
        via[pick] = best[pick]!.to;
    }
    // A removed graphic's twin may have gone later: follow to one that stays, the flips adding up.
    const order: number[] = [], index = new Array(n).fill(-1);
    for (let s = 0; s < n; s++) if (alive[s]) { index[s] = order.length; order.push(s); }
    const remap = slots.map((_, s): Placed => {
        let h = 0, v = 0, at = s;
        while (!alive[at]) { const t = via[at]!; h ^= t.h; v ^= t.v; at = t.slot; }
        return { slot: index[at], h, v };
    });
    return { slots: order.map((s) => slots[s]), remap, removed: n - order.length };
}

export type { Placed };
export { EMPTY_GRAPHIC, encodeGraphic, slotChr, graphicTable, fitGraphics };
