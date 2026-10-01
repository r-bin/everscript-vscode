// Ownership: procedural tile generation using vanilla directional and
// undirected relationship scores. Pure; no ROM reading.
//
// Generates a grid of tiles (e.g. 3x3 or 4x4) starting from a seed graphic,
// satisfying directional adjacency constraints (N/E/S/W) where attested,
// and falling back to undirected relationship scores when unconstrained.

import { DirectionalAdjacency, GridLayer, directionalNeighbours } from './vanilla-adjacency';
import { VanillaIndex } from './vanilla-index';
import { relatedGraphics } from './vanilla-related';

export interface ProceduralTile {
    graphic: number;
    family: number | null;
}

interface DirConstraint {
    dx: number;
    dy: number;
    fromSide: 'n' | 'e' | 's' | 'w';
}

const DIRS: readonly DirConstraint[] = [
    { dx: 0, dy: -1, fromSide: 's' }, // neighbor above us: what does it draw to its south?
    { dx: 0, dy: 1, fromSide: 'n' },  // neighbor below us: what does it draw to its north?
    { dx: -1, dy: 0, fromSide: 'e' }, // neighbor to our left: what does it draw to its east?
    { dx: 1, dy: 0, fromSide: 'w' },  // neighbor to our right: what does it draw to its west?
];

/**
 * Generate a grid of tiles around `seedGraphic` on `layer`, sized `width` x `height`.
 *
 * Uses weighted probabilistic sampling based on attested directional neighbor
 * frequencies and relationship scores, so calling this repeatedly produces
 * coherent yet diverse combinations.
 */
export function proceduralPatch(
    index: VanillaIndex,
    seedGraphic: number,
    layer: GridLayer,
    width = 3,
    height = 3,
    rng: () => number = Math.random,
): ProceduralTile[][] {
    const w = Math.max(1, Math.min(8, width));
    const h = Math.max(1, Math.min(8, height));
    const grid: (number | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));

    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    grid[cy][cx] = seedGraphic;

    // Fill order: radiating outwards from the center seed
    const queue: { x: number; y: number; dist: number }[] = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (x === cx && y === cy) continue;
            queue.push({ x, y, dist: Math.abs(x - cx) + Math.abs(y - cy) });
        }
    }
    queue.sort((a, b) => a.dist - b.dist);

    for (const { x, y } of queue) {
        const scores = new Map<number, number>();

        for (const d of DIRS) {
            const nx = x + d.dx;
            const ny = y + d.dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const ng = grid[ny][nx];
                if (ng !== null) {
                    const dn = directionalNeighbours(index.directional, ng, layer, 10);
                    const candidates = dn[d.fromSide] || [];
                    for (const c of candidates) {
                        const prev = scores.get(c.graphic) || 0;
                        scores.set(c.graphic, prev + (c.score || 0.1) * (c.uses || 1));
                    }
                }
            }
        }

        // If no directional constraint matched, fall back to undirected related tiles
        if (scores.size === 0) {
            const rel = relatedGraphics(index, seedGraphic, 16);
            for (const r of rel) {
                scores.set(r.graphic, (r.score || 0.1) * (r.uses || 1));
            }
        }

        const entries = [...scores.entries()];
        if (entries.length === 0) {
            grid[y][x] = seedGraphic;
            continue;
        }

        const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
        let roll = rng() * totalWeight;
        let chosen = entries[0][0];
        for (const [cand, weight] of entries) {
            roll -= weight;
            if (roll <= 0) {
                chosen = cand;
                break;
            }
        }
        grid[y][x] = chosen;
    }

    return grid.map((row) => row.map((g) => {
        const fam = g !== null ? index.families.get(g) : null;
        const famId = fam && fam.length ? fam[0].value : null;
        return {
            graphic: g ?? seedGraphic,
            family: famId,
        };
    }));
}
