// Ownership: the one pass over every vanilla room's grid that says what is
// drawn beside what — undirected (the relationship score that ranks tiles)
// and directional (the LIKELY NEIGHBORS plus-shape). Pure; no ROM reading.
//
// Split out of vanilla-index.ts in §8b (docs/map-editor-redesign-plan.md):
// the walk grew a second product and that file was already past 400 lines.
//
// **Direction was always in this loop, it used to be thrown away.** The walk
// visits each cell's right and down neighbour separately and then filed both
// under one undirected pair. A `right` pair also says `b` is east of `a` and
// `a` is west of `b`; a `down` pair says `b` is south of `a` and `a` is north
// of `b`. So the four buckets are counted off the same edges — no second
// scan, no new decoding — and the undirected sum is unchanged:
// `adjacency[a][b] = n + e + s + w`, summed over both layers.

/** A compass side of a cell. */
export type Direction = 'n' | 'e' | 's' | 'w';
export const DIRECTIONS: readonly Direction[] = ['n', 'e', 's', 'w'];
const DIR_CODE: Record<Direction, number> = { n: 0, e: 1, s: 2, w: 3 };

/** Which half of a stamp: 0 is canopy (`layer1`), 1 is terrain (`layer2`). */
export type GridLayer = 0 | 1;

/** A grid cell resolved to graphics: `[canopy, terrain]`, `undefined` if unknown. */
export type ResolvedCell = (number | undefined)[];

/**
 * Directional neighbours, compacted once the walk is over.
 *
 * **Per layer**, keyed `graphic * 2 + layer`. The walk only ever pairs a
 * canopy graphic with canopy graphics and a terrain graphic with terrain —
 * a decoration over a floor is on top of it, not beside it — so a canopy
 * brush's east neighbour is the next piece of the object and a floor
 * brush's is the next piece of floor. Merging the two would hand a gourd
 * the floor tiles it happened to be laid over.
 *
 * Each value is flat `[other * 4 + dir, uses]` pairs, grouped by direction
 * (n, e, s, w) and ranked within each group by the score below, so a query
 * is a scan with no sorting. Typed arrays rather than nested Maps because
 * this lives in the index the extension host caches per ROM: a Map entry
 * costs ~45 bytes on V8, a pair here costs 8.
 */
export interface DirectionalAdjacency {
    pairs: Map<number, Int32Array>;
    /** `graphic * 2 + layer` -> grid cells drawn on that layer. The denominator. */
    cells: Map<number, number>;
}

/** The mutable counts the walk fills; compacted by `compactDirectional`. */
export interface DirectionalTally {
    counts: Map<number, Map<number, number>>;
    cells: Map<number, number>;
}

export function newDirectionalTally(): DirectionalTally {
    return { counts: new Map(), cells: new Map() };
}

/** Bump one nested count by one. */
function bump(into: Map<number, Map<number, number>>, key: number, value: number): void {
    let inner = into.get(key);
    if (!inner) { inner = new Map(); into.set(key, inner); }
    inner.set(value, (inner.get(value) || 0) + 1);
}

/**
 * Count one resolved grid's adjacency, both ways at once.
 *
 * Only the right and the down neighbour, because that visits every edge of
 * the grid exactly once — adding left and up would double every count
 * without adding a fact. The two layers are counted separately: a canopy
 * tile sitting over a floor tile is not "next to" it, it is on top of it.
 *
 * A tile beside a copy of itself is skipped in both products. For the
 * relationship score every tiled floor would otherwise score 1; for the
 * plus-shape, "more of the same" is the brush already armed, so it is not
 * a candidate to offer.
 *
 * Returns the number of undirected edges counted.
 */
export function walkResolvedGrid(
    resolved: ResolvedCell[][],
    adjacency: Map<number, Map<number, number>>,
    cells: Map<number, number>,
    tally: DirectionalTally,
): number {
    const height = resolved.length;
    const width = height ? resolved[0].length : 0;
    let edges = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const here = resolved[y][x];
            for (let which = 0; which < 2; which++) {
                const g = here[which];
                if (g === undefined) continue;
                cells.set(g, (cells.get(g) || 0) + 1);
                const key = g * 2 + which;
                tally.cells.set(key, (tally.cells.get(key) || 0) + 1);
            }
            const right = x + 1 < width ? resolved[y][x + 1] : null;
            const down = y + 1 < height ? resolved[y + 1][x] : null;
            for (let which = 0; which < 2; which++) {
                const a = here[which];
                if (a === undefined) continue;
                if (right) edges += pair(adjacency, tally, which, a, right[which], EAST, WEST);
                if (down) edges += pair(adjacency, tally, which, a, down[which], SOUTH, NORTH);
            }
        }
    }
    return edges;
}

const NORTH = DIR_CODE.n;
const EAST = DIR_CODE.e;
const SOUTH = DIR_CODE.s;
const WEST = DIR_CODE.w;

/**
 * Count one edge: `b` lies `ahead` of `a` (east or south), so `a` lies `back`
 * of `b`. Returns 1 if it was an edge worth counting, 0 if not.
 */
function pair(
    adjacency: Map<number, Map<number, number>>,
    tally: DirectionalTally,
    which: number,
    a: number,
    b: number | undefined,
    ahead: number,
    back: number,
): number {
    if (b === undefined || b === a) return 0;
    bump(adjacency, a, b);
    bump(adjacency, b, a);
    bump(tally.counts, a * 2 + which, b * 4 + ahead);
    bump(tally.counts, b * 2 + which, a * 4 + back);
    return 1;
}

/**
 * Jaccard for one side of one layer: `uses / (cells(a) + cells(b) - uses)`.
 *
 * Mirrors `relatedGraphics` (vanilla-index.ts), for the same reason — a raw
 * count ranks by how *common* a neighbour is, not how related. The sets are
 * edge slots: each cell `a` is drawn in on this layer has exactly one east
 * slot, each cell `b` is drawn in has exactly one west slot, and an
 * attested `a|b` edge is both at once. So the union is
 * `cells(a) + cells(b) - uses` and the score is 1 exactly when `a` always
 * has `b` to its east and `b` always has `a` to its west.
 *
 * Why not "edges out of `a` eastward" as the denominator instead: that
 * excludes the self-pairs skipped above and the cells on the room's edge,
 * so a floor that is almost always beside more floor would get a tiny
 * denominator and its rare east neighbour an inflated score. Cells on the
 * layer is the same denominator the undirected score uses, restricted to
 * the layer being asked about.
 */
function score(cellsA: number, cellsB: number, uses: number): number {
    const union = cellsA + cellsB - uses;
    return union > 0 ? uses / union : 0;
}

/** Freeze the tally into the compact, pre-ranked form the index keeps. */
export function compactDirectional(tally: DirectionalTally): DirectionalAdjacency {
    const pairs = new Map<number, Int32Array>();
    for (const [key, inner] of tally.counts) {
        const mine = tally.cells.get(key) || 0;
        const layer = key & 1;
        const rows = [...inner].map(([packed, uses]) => ({
            packed,
            uses,
            s: score(mine, tally.cells.get((packed >> 2) * 2 + layer) || 0, uses),
        }));
        rows.sort((a, b) => (a.packed & 3) - (b.packed & 3) || b.s - a.s || b.uses - a.uses
            || a.packed - b.packed);
        const flat = new Int32Array(rows.length * 2);
        rows.forEach((r, i) => { flat[i * 2] = r.packed; flat[i * 2 + 1] = r.uses; });
        pairs.set(key, flat);
    }
    return { pairs, cells: tally.cells };
}

/** One attested neighbour on one side. */
export interface DirectionalRelated {
    graphic: number;
    /** Times vanilla drew it on exactly this side, on this layer. */
    uses: number;
    /** Per-side Jaccard, 0..1 — see `score`. */
    score: number;
}

/**
 * What vanilla draws on each side of this graphic, on one layer, best first.
 *
 * A side vanilla never drew anything on comes back as an empty list, not
 * padded from another side or from the undirected score: the plus-shape
 * shows an empty cell there, because that is what the ROM says.
 */
export function directionalNeighbours(
    directional: DirectionalAdjacency,
    graphic: number,
    layer: GridLayer,
    limit = 6,
): Record<Direction, DirectionalRelated[]> {
    const out: Record<Direction, DirectionalRelated[]> = { n: [], e: [], s: [], w: [] };
    const key = graphic * 2 + layer;
    const flat = directional.pairs.get(key);
    if (!flat) return out;
    const mine = directional.cells.get(key) || 0;
    for (let i = 0; i < flat.length; i += 2) {
        const side = out[DIRECTIONS[flat[i] & 3]];
        if (side.length >= limit) continue;
        const other = flat[i] >> 2;
        const uses = flat[i + 1];
        side.push({
            graphic: other,
            uses,
            score: score(mine, directional.cells.get(other * 2 + layer) || 0, uses),
        });
    }
    return out;
}
