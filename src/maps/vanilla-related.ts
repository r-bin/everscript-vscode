// Ownership: how strongly vanilla relates two graphics — drawn beside each
// other — and ranking candidates by it. Pure.
//
// Split out of vanilla-index.ts (which builds the counts) for the 400-line
// limit: reading relationships off the index is its own job.

import { VanillaIndex } from './vanilla-index';

/** A graphic the index has seen drawn beside another, and how strongly. */
export interface Related {
    graphic: number;
    /** Times the two were adjacent. */
    uses: number;
    /** Jaccard: `uses / (cells(a) + cells(b) - uses)`, 0..1. */
    score: number;
}

/**
 * What vanilla draws beside this graphic, strongest relationship first.
 *
 * The score is **Jaccard**, not the raw count, because a raw count ranks by
 * how common the neighbour is rather than how related it is: graphic 3736's
 * raw top four are the other two gourd pieces *and* the floor and wall it
 * happened to be standing against. Jaccard puts the two gourd pieces at
 * exactly 1.00 — always adjacent, never apart — and drops the floor to 0.04.
 *
 * `count / min(a, b)` was the other candidate and has a degenerate case: a
 * graphic placed twice, both times beside the query, also scores 1.00.
 */
export function relatedGraphics(index: VanillaIndex, graphic: number, limit = 12): Related[] {
    const inner = index.adjacency.get(graphic);
    if (!inner) return [];
    const mine = index.cells.get(graphic) || 0;
    const out: Related[] = [];
    for (const [other, uses] of inner) {
        const union = mine + (index.cells.get(other) || 0) - uses;
        // Capped: edges are counted per side, so a pair can share more edges
        // than the union has cells (it read 114% in the Tile tab).
        out.push({ graphic: other, uses, score: union > 0 ? Math.min(1, uses / union) : 0 });
    }
    out.sort((a, b) => b.score - a.score || b.uses - a.uses || a.graphic - b.graphic);
    return out.slice(0, limit);
}

/**
 * How strongly these two graphics belong together, 0..1.
 *
 * Zero for a pair vanilla never puts side by side, which is the whole of
 * "never placed next to each other means a low relationship value".
 */
export function relationship(index: VanillaIndex, a: number, b: number): number {
    if (a === b) return 1;
    const uses = index.adjacency.get(a)?.get(b) || 0;
    if (!uses) return 0;
    const union = (index.cells.get(a) || 0) + (index.cells.get(b) || 0) - uses;
    return union > 0 ? Math.min(1, uses / union) : 0;
}

/**
 * Rank candidates by how well they go with everything already placed.
 *
 * The score against a set is the **best** single relationship, not the mean:
 * a tile that belongs with one thing in the room belongs in the room. Taking
 * the average would punish it for being unrelated to the floor.
 */
export function rankByRelationship(
    index: VanillaIndex,
    candidates: number[],
    placed: number[],
): Related[] {
    if (!placed.length) return candidates.map((g) => ({ graphic: g, uses: 0, score: 0 }));
    const out = candidates.map((graphic) => {
        let best = 0;
        let uses = 0;
        for (const p of placed) {
            const s = relationship(index, p, graphic);
            if (s > best) { best = s; uses = index.adjacency.get(p)?.get(graphic) || 0; }
        }
        return { graphic, uses, score: best };
    });
    out.sort((a, b) => b.score - a.score || b.uses - a.uses || a.graphic - b.graphic);
    return out;
}
