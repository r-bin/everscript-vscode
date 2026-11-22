// Ownership: Terranigma metatiles as Evermore 16x16 graphics — one palette and one priority per cell
// (docs/terra/evermore-rooms.md): the pixels a metatile draws, which of the room's eight background
// palettes become Evermore's seven family slots, a tile's palette and recolouring, its priority, and
// Terranigma's backdrop where Evermore would show black. Pure.
//
// Only SNES facts are shared with Evermore: a metatile is four Mode 1 tilemap words (v-flip 15,
// h-flip 14, priority 13, palette 10-12, character 0-9) over 4bpp characters at the BG's base.

import { dist, nearest } from '../common/colours';

/** What the drawing reads of a loaded room: VRAM, the byte address of the BGs' characters, 256 colours. */
interface Chars { vram: Uint8Array; base: number; palette: Uint16Array }

/** A metatile as Terranigma draws it: colour index, palette and priority bit per pixel (16x16, row by row). */
interface Raw { px: Uint8Array; pal: Uint8Array; hi: Uint8Array; opaque: number; high: number }

/** Evermore keeps palette 0 for its HUD, so a room has slots 1-7 for its families. */
const FAMILY_SLOTS = 7;
const NONE: ReadonlySet<number> = new Set();

/** Metatile `n` of a layer's table (512 × 4 tilemap words). */
function rawTile(src: Chars, table: Uint16Array, n: number): Raw {
    const px = new Uint8Array(256), pal = new Uint8Array(256), hi = new Uint8Array(256);
    let opaque = 0, high = 0;
    for (let q = 0; q < 4; q++) {
        const word = table[n * 4 + q];
        const base = (src.base + (word & 0x3FF) * 32) & 0xFFFF, p = (word >> 10) & 7;
        const hf = word & 0x4000, vf = word & 0x8000;
        for (let y = 0; y < 8; y++) {
            const r = base + (vf ? 7 - y : y) * 2;
            const p0 = src.vram[r], p1 = src.vram[r + 1], p2 = src.vram[r + 16], p3 = src.vram[r + 17];
            for (let x = 0; x < 8; x++) {
                const bit = hf ? x : 7 - x;
                const c = ((p0 >> bit) & 1) | ((p1 >> bit) & 1) << 1 | ((p2 >> bit) & 1) << 2 | ((p3 >> bit) & 1) << 3;
                if (!c) continue;
                const i = ((q >> 1) * 8 + y) * 16 + (q & 1) * 8 + x;
                px[i] = c; pal[i] = p; opaque++;
                if (word & 0x2000) { hi[i] = 1; high++; }
            }
        }
    }
    return { px, pal, hi, opaque, high };
}

/** The pixels of `t` with the priority bit set (`high`), or those without it. */
function priorityPart(t: Raw, high: boolean): Raw {
    const px = new Uint8Array(256), pal = new Uint8Array(256), hi = new Uint8Array(256);
    let opaque = 0;
    for (let i = 0; i < 256; i++) {
        if (!t.px[i] || !!t.hi[i] !== high) continue;
        px[i] = t.px[i]; pal[i] = t.pal[i]; hi[i] = t.hi[i]; opaque++;
    }
    return { px, pal, hi, opaque, high: high ? opaque : 0 };
}

/** The palettes that become families: the (at most seven) most drawn of the tiles shown, in palette order. */
function keptPalettes(tiles: Iterable<Raw>): number[] {
    const count = new Array(8).fill(0);
    for (const t of tiles) for (let i = 0; i < 256; i++) if (t.px[i]) count[t.pal[i]]++;
    const used = count.map((c, p) => [c, p]).filter(([c]) => c > 0).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const kept = used.slice(0, FAMILY_SLOTS).map(([, p]) => p).sort((a, b) => a - b);
    return kept.length ? kept : [0];
}

/**
 * A copy of the palette with `backdrop` written into one colour of each kept palette that no shown pixel
 * draws with: Evermore's backdrop is black, so where Terranigma shows its backdrop the tiles are filled with
 * that colour, and this makes it exact. A palette with every colour in use gets the nearest instead.
 */
function withBackdrop(palette: Uint16Array, kept: number[], tiles: Iterable<Raw>, backdrop: number, rotating: ReadonlySet<number> = NONE): Uint16Array {
    const out = palette.slice(), used = new Map<number, Set<number>>(kept.map((p) => [p, new Set<number>()]));
    for (const t of tiles) for (let i = 0; i < 256; i++) if (t.px[i]) used.get(t.pal[i])?.add(t.px[i]);
    for (const p of kept) {
        for (let k = 1; k < 16; k++) if (!used.get(p)!.has(k) && !rotating.has(p * 16 + k)) { out[p * 16 + k] = backdrop; break; }
    }
    return out;
}

/**
 * The palette a tile is drawn in: of the kept palettes it draws with (all kept ones when it draws with none
 * of them), the one its other pixels move least to, the one with most pixels on a tie.
 */
function mainPalette(cgram: Uint16Array, t: Raw, kept: number[], rotating: ReadonlySet<number>): number {
    const count = new Array(8).fill(0);
    for (let i = 0; i < 256; i++) if (t.px[i]) count[t.pal[i]]++;
    const own = kept.filter((p) => count[p]);
    let main = (own.length ? own : kept)[0], best = Infinity;
    for (const to of own.length ? own : kept) {
        let err = 0;
        for (let i = 0; i < 256; i++) {
            if (t.px[i] && t.pal[i] !== to) err += dist(cgram[t.pal[i] * 16 + t.px[i]], cgram[to * 16 + nearest(cgram, cgram[t.pal[i] * 16 + t.px[i]], to, rotating)]);
        }
        if (err < best || (err === best && count[to] > count[main])) { best = err; main = to; }
    }
    return main;
}

type Stats = { recolouredTiles: number; recolouredPixels: number; mixedPriority: number; droppedGraphics: number };

/**
 * A tile in one palette and one priority (the majority of its opaque pixels): what an Evermore graphic can hold.
 * A recoloured pixel never takes a colour that rotates (`rotating`, CGRAM indices): it would blink with a cycle.
 */
function convertTile(cgram: Uint16Array, t: Raw, kept: number[], stats: Stats, rotating: ReadonlySet<number> = NONE) {
    if (!t.opaque) return { px: t.px, palette: kept[0], priority: 0, empty: true };
    const palette = mainPalette(cgram, t, kept, rotating);
    const px = t.px.slice();
    let moved = 0;
    for (let i = 0; i < 256; i++) {
        if (px[i] && t.pal[i] !== palette) { px[i] = nearest(cgram, cgram[t.pal[i] * 16 + t.px[i]], palette, rotating); moved++; }
    }
    if (moved) { stats.recolouredTiles++; stats.recolouredPixels += moved; }
    if (t.high && t.high < t.opaque) stats.mixedPriority++;
    return { px, palette, priority: t.high * 2 >= t.opaque ? 1 : 0, empty: false };
}

/** `px` with its transparent pixels that `open` allows (all, when null) set to the colour nearest `backdrop`. */
function fillBackdrop(cgram: Uint16Array, px: Uint8Array, palette: number, backdrop: number, open: Uint8Array | null, rotating: ReadonlySet<number> = NONE): Uint8Array {
    const k = nearest(cgram, backdrop, palette, rotating), out = px.slice();
    for (let i = 0; i < 256; i++) if (!out[i] && (!open || open[i])) out[i] = k;
    return out;
}

/** The kept palette whose nearest colour to `backdrop` is closest, and that colour: an empty cell's solid fill. */
function backdropColour(cgram: Uint16Array, kept: number[], backdrop: number, rotating: ReadonlySet<number> = NONE) {
    let best = { palette: kept[0], k: 1, d: Infinity };
    for (const p of kept) {
        const k = nearest(cgram, backdrop, p, rotating), d = dist(cgram[p * 16 + k], backdrop);
        if (d < best.d) best = { palette: p, k, d };
    }
    return best;
}

export type { Chars, Raw, Stats };
export { rawTile, priorityPart, keptPalettes, withBackdrop, convertTile, fillBackdrop, backdropColour };
