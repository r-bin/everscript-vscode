// Ownership: a map's event-flag pieces — the parts of the map that change as the story moves on.
//
// A piece is placed only while its event flag is in its range ($00:CB90, docs/mana/README.md "Pieces
// and layers"): the Potos ground breaking open is piece 13 of map $66, shown from flag $10 = 6. Per event
// flag, state 0 is the map as drawn with every flag 0; each other flag value that changes what is placed
// is one more state, holding the cells it changes (metatile numbers of both layers). The area is the box
// around every cell any state of that flag changes.

import { Rom } from './rom';
import { ManaMap } from './map';
import { readPlacements, assembleLayers, LAYER_A, LAYER_B, ROW } from './placement';

const MAX_STATES = 16;

export interface FlagPiece {
    flag: number;
    /** `values[s]` is the first flag value that shows state `s` (state 0 is value 0). */
    values: number[];
    x: number; y: number; w: number; h: number;
    /** One per state after state 0: `"dx,dy"` (inside the area) -> the metatile of layer A and B there. */
    frames: Array<Record<string, { A: number; B: number }>>;
}

export function flagPieces(rom: Rom, map: ManaMap): FlagPiece[] {
    const records = readPlacements(rom, map.id).filter(r => !(r.min === 0 && r.max === 15));
    const flags = [...new Set(records.map(r => r.flag))].sort((a, b) => a - b);
    const out: FlagPiece[] = [];
    for (const flag of flags) {
        const mine = records.filter(r => r.flag === flag);
        const seen = new Map<string, number>();
        for (let v = 0; v < 16 && seen.size < MAX_STATES; v++) {
            const sig = mine.map(r => (v >= r.min && v <= r.max ? 1 : 0)).join('');
            if (!seen.has(sig)) seen.set(sig, v);
        }
        const values = [...seen.values()];
        if (values.length < 2) continue;
        const states = values.slice(1).map(v => {
            const layers = assembleLayers(rom, map.id, f => (f === flag ? v : 0));
            const changed = new Map<string, { A: number; B: number }>();
            for (let y = 0; y < map.h; y++) {
                for (let x = 0; x < map.w; x++) {
                    const a = layers.mem[LAYER_A + y * ROW + x];
                    const b = layers.sizeB ? layers.mem[LAYER_B + (y % layers.sizeB.h) * ROW + (x % layers.sizeB.w)] : -1;
                    if (a !== map.cell('A', x, y) || b !== map.cell('B', x, y)) changed.set(x + ',' + y, { A: a, B: b });
                }
            }
            return changed;
        });
        const cells = states.flatMap(s => [...s.keys()].map(k => k.split(',').map(Number)));
        if (!cells.length) continue;
        const x0 = Math.min(...cells.map(c => c[0])), y0 = Math.min(...cells.map(c => c[1]));
        const x1 = Math.max(...cells.map(c => c[0])), y1 = Math.max(...cells.map(c => c[1]));
        out.push({
            flag, values, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1,
            frames: states.map(s => {
                const f: Record<string, { A: number; B: number }> = {};
                for (const [k, v] of s) { const [x, y] = k.split(',').map(Number); f[(x - x0) + ',' + (y - y0)] = v; }
                return f;
            }),
        });
    }
    return out;
}
