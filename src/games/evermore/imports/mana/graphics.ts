// Ownership: Mana metatiles as Evermore 16x16 graphics — one palette and one priority per cell
// (docs/mana/evermore-rooms.md): the palette choice and recolouring, the priority choice and the
// pixels Mana never shows, Mana's backdrop where Evermore would draw black, Evermore's graphic
// layout, and the graphics list (deduplicated, mirrored copies sharing a slot). Pure.

import * as mana from '../../../mana/decoder';
import { MAX_GRAPHICS } from './ids';
import { flipH, flipV, keyOf } from './pixels';
import type { ManaMap } from '../../../mana/decoder';

type Stats = { recolouredTiles: number; recolouredPixels: number; mixedPriority: number; droppedGraphics: number; hiddenPixels?: number };
type Trace = NonNullable<ReturnType<typeof mana.traceAnimation>>;
type Placed = { slot: number; h: number; v: number };
type Layer = 'A' | 'B';

const EMPTY_GRAPHIC = 0;        // slot 0 is always the fully transparent graphic

const rgb = (c: number): number[] => [c & 31, (c >> 5) & 31, (c >> 10) & 31];

/** Squared distance between two BGR555 colours. */
function dist(a: number, b: number): number {
    const x = rgb(a), y = rgb(b);
    return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
}

/**
 * The palette a mixed metatile is drawn in: the one its other pixels move least to (nearest
 * still colour each), the one with most pixels on a tie. A count alone put the waterfall's
 * foam (palette 7) into the water's palette 6 at Potos Falls, half and half.
 */
function mainPalette(cgram: Uint16Array, px: Uint8Array, pal: Uint8Array, palCount: number[], rotating: ReadonlySet<number>): number {
    let main = 1, best = Infinity;
    for (let to = 1; to < 8; to++) {
        if (!palCount[to]) continue;
        let err = 0;
        for (let i = 0; i < 256; i++) {
            if (px[i] && pal[i] !== to) err += dist(cgram[pal[i] * 16 + px[i]], cgram[to * 16 + nearest(cgram, cgram[pal[i] * 16 + px[i]], to, rotating)]);
        }
        if (err < best || (err === best && palCount[to] > palCount[main])) { best = err; main = to; }
    }
    return main;
}

/**
 * The colour of palette `to` (index 1..15) nearest to BGR555 `colour`, never one that rotates
 * (`rotating`, CGRAM indices): a redrawn pixel would blink with a cycle it is not part of.
 */
function nearest(cgram: Uint16Array, colour: number, to: number, rotating: ReadonlySet<number>): number {
    const want = rgb(colour);
    let best = 1, bestD = Infinity;
    for (let k = 1; k < 16; k++) {
        if (rotating.has(to * 16 + k)) continue;
        const have = rgb(cgram[to * 16 + k]);
        const d = (want[0] - have[0]) ** 2 + (want[1] - have[1]) ** 2 + (want[2] - have[2]) ** 2;
        if (d < bestD) { bestD = d; best = k; }
    }
    return best;
}

interface PixelOptions {
    /** The characters at one moment of an animation (default: at load). */
    vram?: Uint8Array;
    /** A palette chosen before (an animation's frames keep frame 0's). */
    main?: number;
    /** Pixels Mana never shows when they are low priority: the layer below covers them (hiddenUnder). */
    hide?: Uint8Array | null;
    /** BGR555 colour to fill a low-priority tile's transparent pixels with: Mana's backdrop. */
    backdrop?: number;
    /** With `backdrop`: transparent pixels filled whatever the tile's priority (`backdropOpen`). */
    open?: Uint8Array;
    /** With `backdrop`: false fills a priority-0 tile only where `open` says so too. */
    fillLow?: boolean;
}

/**
 * A metatile drawn as one 16x16 graphic: 256 colour indices, its palette and priority.
 * One priority per cell: the majority, or 0 when that composes as Mana does (below); a
 * priority-0 pixel that would then come in front of what Mana draws over it (`hide`) is left out. A layer-B tile of priority 0 shows `backdrop` where it
 * is transparent, as Mana's backdrop shows there (Evermore's is black); one of priority 1 (or any, `fillLow` false) where `open` says so.
 */
function metatilePixels(map: ManaMap, table: Uint16Array, n: number, stats: Stats, rotating: ReadonlySet<number>, opts: PixelOptions = {}) {
    const vram = opts.vram || map.vram;
    let main = opts.main || 0;
    const px = new Uint8Array(256), pal = new Uint8Array(256), hi = new Uint8Array(256);
    const palCount = new Array(8).fill(0);
    let prio = 0, opaque = 0;
    for (let q = 0; q < 4; q++) {
        const word = table[n * 4 + q];
        const base = (word & 0x3FF) * 32, p = (word >> 10) & 7;
        const hf = word & 0x4000, vf = word & 0x8000;
        for (let y = 0; y < 8; y++) {
            const r = base + (vf ? 7 - y : y) * 2;
            const p0 = vram[r], p1 = vram[r + 1], p2 = vram[r + 16], p3 = vram[r + 17];
            for (let x = 0; x < 8; x++) {
                const bit = hf ? x : 7 - x;
                const c = ((p0 >> bit) & 1) | ((p1 >> bit) & 1) << 1 | ((p2 >> bit) & 1) << 2 | ((p3 >> bit) & 1) << 3;
                if (!c) continue;
                const i = ((q >> 1) * 8 + y) * 16 + (q & 1) * 8 + x;
                px[i] = c; pal[i] = p;
                palCount[p]++; opaque++;
                if (word & 0x2000) { prio++; hi[i] = 1; }
            }
        }
    }
    if (!opaque) return { px, palette: 1, priority: 0, empty: true };
    let priority = prio * 2 >= opaque ? 1 : 0;
    if (prio && prio < opaque) stats.mixedPriority++;
    // Priority 0 composes exactly as Mana when no high-priority pixel of this tile lies over a
    // high-priority pixel below: the layer below then covers its low pixels on the main screen and
    // they still blend in from the sub screen (Potos Falls' planks under the deck, half-added to the water).
    if (priority && opts.hide && prio < opaque && !hi.some((h, i) => h && opts.hide![i])) priority = 0;
    if (priority && opts.hide) {
        for (let i = 0; i < 256; i++) {
            if (px[i] && !hi[i] && opts.hide[i]) { palCount[pal[i]]--; px[i] = 0; stats.hiddenPixels = (stats.hiddenPixels || 0) + 1; }
        }
    }
    if (!main) main = mainPalette(map.cgram, px, pal, palCount, rotating);
    if (palCount[main] < palCount.reduce((a, b) => a + b, 0)) {
        stats.recolouredTiles++;
        for (let i = 0; i < 256; i++) {
            if (px[i] && pal[i] !== main) { px[i] = nearest(map.cgram, map.cgram[pal[i] * 16 + px[i]], main, rotating); stats.recolouredPixels++; }
        }
    }
    const all = !priority && opts.fillLow !== false;
    if (opts.backdrop !== undefined && (all || opts.open)) {
        const k = nearest(map.cgram, opts.backdrop, main, rotating);
        for (let i = 0; i < 256; i++) if (!px[i] && (all || opts.open![i])) px[i] = k;
    }
    return { px, palette: main, priority, empty: false };
}


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

/** The graphics list: deduplicated, mirrored copies sharing one slot. */
function graphicTable(stats: Stats) {
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
            if (slots.length >= MAX_GRAPHICS) { stats.droppedGraphics++; return { slot: EMPTY_GRAPHIC, h: 0, v: 0 }; }
            index.set(keyOf(px), slots.length);
            slots.push(px);
            return { slot: slots.length - 1, h: 0, v: 0 };
        },
    };
}
type Tile = { m: ReturnType<typeof metatilePixels>; g: Placed };

/** Per pixel: opaque, and priority set, for metatile `n` of a layer as Mana draws it at load. */
function rawPixels(map: ManaMap, table: Uint16Array, n: number) {
    const shown = new Uint8Array(256);
    for (let q = 0; q < 4; q++) {
        const word = table[n * 4 + q], base = (word & 0x3FF) * 32, hf = word & 0x4000, vf = word & 0x8000;
        for (let y = 0; y < 8; y++) {
            const r = base + (vf ? 7 - y : y) * 2;
            for (let x = 0; x < 8; x++) {
                const bit = hf ? x : 7 - x;
                const c = ((map.vram[r] >> bit) & 1) | ((map.vram[r + 1] >> bit) & 1) << 1 | ((map.vram[r + 16] >> bit) & 1) << 2 | ((map.vram[r + 17] >> bit) & 1) << 3;
                if (c) shown[((q >> 1) * 8 + y) * 16 + (q & 1) * 8 + x] = word & 0x2000 ? 2 : 1;
            }
        }
    }
    return shown;
}

/**
 * Per layer-A metatile, the pixels a priority-1 layer-B pixel covers in every cell it is drawn
 * in (Mode 1: BG2 priority 1 is over BG1 priority 0). Potos Falls' bridge: the planks under the
 * deck are priority 0 and the water below them priority 1, so Mana shows water there.
 */
function hiddenUnder(map: ManaMap) {
    const out = new Map<number, Uint8Array>(), bCache = new Map<number, Uint8Array>();
    const bOf = (n: number) => {
        let b = bCache.get(n);
        if (!b) { b = n >= 0 && n < 192 ? rawPixels(map, map.tableB, n) : new Uint8Array(256); bCache.set(n, b); }
        return b;
    };
    for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
            const a = map.cell('A', x, y);
            if (a < 0 || a >= 192) continue;
            const b = bOf(map.cell('B', x, y));
            const m = out.get(a);
            if (!m) { out.set(a, Uint8Array.from(b, (v) => (v === 2 ? 1 : 0))); continue; }
            for (let i = 0; i < 256; i++) if (b[i] !== 2) m[i] = 0;
        }
    }
    return out;
}

/**
 * The map's colours at the animation's starting moment, with Mana's backdrop written into the
 * first index of each palette that no metatile draws with (any animation state) and no cycle
 * rotates. Evermore's backdrop is black; this makes the filled pixels exactly Mana's.
 */
function withBackdrop(map: ManaMap, trace: Trace | null, rotating: ReadonlySet<number>): Uint16Array {
    const cgram = (trace ? trace.cgram : map.cgram).slice();
    const used = Array.from({ length: 8 }, () => new Set<number>());
    const states = (ch: number) => {
        const out = [map.vram.subarray(ch * 32, ch * 32 + 32)];
        if (trace) for (const st of trace.steps) { const d = st.chars.get(ch); if (d) out.push(d); }
        return out;
    };
    for (const table of [map.tableA, map.tableB]) {
        for (let i = 0; i < table.length; i++) {
            const p = (table[i] >> 10) & 7;
            for (const d of states(table[i] & 0x3FF)) {
                for (let r = 0; r < 8; r++) for (let b = 0; b < 8; b++) {
                    const c = ((d[r * 2] >> b) & 1) | ((d[r * 2 + 1] >> b) & 1) << 1 | ((d[16 + r * 2] >> b) & 1) << 2 | ((d[17 + r * 2] >> b) & 1) << 3;
                    if (c) used[p].add(c);
                }
            }
        }
    }
    for (let p = 1; p < 8; p++) {
        for (let k = 1; k < 16; k++) {
            if (!used[p].has(k) && !rotating.has(p * 16 + k)) { cgram[p * 16 + k] = map.display.backdrop; break; }
        }
    }
    return cgram;
}

/**
 * Per layer-B metatile, the transparent pixels its fill may cover whatever its priority: those
 * no layer-A pixel that counts covers in any cell (`pairs`: every A, B pair a cell shows; `cover`:
 * a layer-A metatile's pixels that count, null for none). Mana shows its backdrop there.
 */
function backdropOpen(pairs: Iterable<[number, number]>, cover: (a: number) => Uint8Array | null) {
    const out = new Map<number, Uint8Array>();
    for (const [a, b] of pairs) {
        let open = out.get(b);
        if (!open) { open = new Uint8Array(256).fill(1); out.set(b, open); }
        const c = cover(a);
        if (c) for (let i = 0; i < 256; i++) if (c[i]) open[i] = 0;
    }
    return out;
}

/**
 * The pixels metatile `n` of `table` draws at any moment of the trace, or at every moment
 * (`every`); `draw` draws it at a moment's characters.
 */
function opaqueOver(trace: Trace, n: number, table: Uint16Array, every: boolean, draw: (vram: Uint8Array) => Uint8Array) {
    const out = Uint8Array.from(draw(trace.vram), (v) => (v ? 1 : 0));
    const vram = trace.vram.slice(), chars = new Set([0, 1, 2, 3].map((q) => table[n * 4 + q] & 0x3FF));
    for (const st of trace.steps) {
        for (const [c, d] of st.chars) vram.set(d, c * 32);
        if (![...st.chars.keys()].some((c) => chars.has(c))) continue;
        draw(vram).forEach((v, i) => { if (every ? !v : v) out[i] = every ? 0 : 1; });
    }
    return out;
}

/** A solid graphic in the colour nearest Mana's backdrop (still colours only), in the palette that has the nearest. */
function backdropTile(map: ManaMap, tiles: Record<Layer, Map<number, Tile>>, rotating: ReadonlySet<number>, graphics: ReturnType<typeof graphicTable>) {
    if (![...tiles.B.values()].some((t) => t.m.empty) && tiles.B.size) return null;
    const palettes = new Set<number>();
    for (const layer of ['A', 'B'] as Layer[]) for (const t of tiles[layer].values()) if (!t.m.empty) palettes.add(t.m.palette);
    let best: { palette: number; k: number; d: number } | null = null;
    for (const p of palettes) {
        const k = nearest(map.cgram, map.display.backdrop, p, rotating), d = dist(map.cgram[p * 16 + k], map.display.backdrop);
        if (!best || d < best.d) best = { palette: p, k, d };
    }
    if (!best) return null;
    return { palette: best.palette, slot: graphics.place(new Uint8Array(256).fill(best.k)).slot };
}

export type { Stats, Trace, Placed, Layer, Tile, PixelOptions };
export { EMPTY_GRAPHIC, metatilePixels, encodeGraphic, slotChr, graphicTable, hiddenUnder, withBackdrop, backdropOpen, opaqueOver, backdropTile };
