// Ownership: turning an animation trace into per-cell frames a viewer can play.
//
// A cell animates when one of its eight characters (four per layer) changes or a
// colour it actually draws with cycles. Cells with the same tile words on both
// layers look the same at every moment, so they form one kind: its frames are
// drawn once (16x16, both layers, colour math) and placed at every such cell.

import { ManaMap } from './map';
import { AnimationTrace } from './animate';
import { renderMap, ManaImage } from './render';

export interface AnimatedKind {
    cells: Array<[number, number]>;
    /** Frame k shows from frame `starts[k]` of the loop until the next start. */
    starts: number[];
    images: ManaImage[];
}

export interface CellAnimation {
    length: number;               // frames in one loop (60 per second)
    kinds: AnimatedKind[];
}

function cellWords(map: ManaMap, x: number, y: number): number[] {
    const words: number[] = [];
    for (const [layer, table] of [['A', map.tableA], ['B', map.tableB]] as const) {
        const n = map.cell(layer, x, y);
        for (let q = 0; q < 4; q++) words.push(n >= 0 && n < 192 ? table[n * 4 + q] : -1);
    }
    return words;
}

/** Colour indices 1-15 a character's pixels use, over every state it takes. */
function usedColours(trace: AnimationTrace, char: number): Set<number> {
    const out = new Set<number>();
    const scan = (d: Uint8Array) => {
        for (let r = 0; r < 8; r++) for (let b = 0; b < 8; b++) {
            const c = ((d[r * 2] >> b) & 1) | ((d[r * 2 + 1] >> b) & 1) << 1 | ((d[16 + r * 2] >> b) & 1) << 2 | ((d[17 + r * 2] >> b) & 1) << 3;
            if (c) out.add(c);
        }
    };
    scan(trace.vram.subarray(char * 32, char * 32 + 32));
    for (const s of trace.steps) { const d = s.chars.get(char); if (d) scan(d); }
    return out;
}

export function animateCells(map: ManaMap, trace: AnimationTrace): CellAnimation {
    const colourCache = new Map<number, Set<number>>();
    const colours = (char: number) => {
        let s = colourCache.get(char);
        if (!s) { s = usedColours(trace, char); colourCache.set(char, s); }
        return s;
    };
    // Group the animated cells by their tile words; remember what each kind reacts to.
    const groups = new Map<string, { cells: Array<[number, number]>; chars: Set<number>; cols: Set<number> }>();
    for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
            const words = cellWords(map, x, y).filter(w => w >= 0);
            const chars = new Set<number>(), cols = new Set<number>();
            for (const w of words) {
                const ch = w & 0x3FF, pal = ((w >> 10) & 7) * 16;
                if (trace.chars.has(ch)) chars.add(ch);
                for (const c of colours(ch)) if (trace.colours.has(pal + c)) cols.add(pal + c);
            }
            if (!chars.size && !cols.size) continue;
            const key = words.join(',');
            const g = groups.get(key) ?? { cells: [], chars, cols };
            g.cells.push([x, y]);
            groups.set(key, g);
        }
    }
    // Replay the trace once, drawing each kind whenever something it shows changed.
    const vram = trace.vram.slice(), cgram = trace.cgram.slice();
    const kinds = [...groups.values()].map(g => {
        const [x, y] = g.cells[0];
        const first = renderMap(map, { x, y, w: 1, h: 1, vram, cgram });
        return { g, kind: { cells: g.cells, starts: [0], images: [first] } as AnimatedKind, last: first.rgba };
    });
    for (const step of trace.steps) {
        for (const [c, d] of step.chars) vram.set(d, c * 32);
        for (const [i, v] of step.colours) cgram[i] = v;
        for (const k of kinds) {
            const touched = [...step.chars.keys()].some(c => k.g.chars.has(c)) || [...step.colours.keys()].some(i => k.g.cols.has(i));
            if (!touched) continue;
            const [x, y] = k.g.cells[0];
            const img = renderMap(map, { x, y, w: 1, h: 1, vram, cgram });
            if (img.rgba.every((v, i) => v === k.last[i])) continue;
            k.kind.starts.push(step.frame);
            k.kind.images.push(img);
            k.last = img.rgba;
        }
    }
    return { length: trace.length, kinds: kinds.map(k => k.kind).filter(k => k.images.length > 1) };
}
