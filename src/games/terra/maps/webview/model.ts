// Ownership: what the Terranigma Maps page knows about a room as plain data — no DOM, unit-tested
// (tests/terra/terra-maps-model.test.js): reading map and tile words, describing a metatile and a cell,
// the rail's rows, which rooms show the same picture, the cell-type overlay. The page (page.dom.ts) and
// the room files (terra://rom/rooms/<hex>.json, games/terra/resources/room-files.ts) are its two ends.
// Facts: docs/terra/README.md §4.

/** One layer of `<hex>.json`. */
export interface LayerData { index: number; bg: number; w: number; h: number; cells: number[]; metatiles: number[] }

/** `terra://rom/rooms/<hex>.json`. */
export interface RoomData {
    id: number; hex: string; w: number; h: number; script: number | null; context: number[];
    sections: { bit: number; name: string }[]; sets: number[]; display: boolean;
    backdrop: number[]; palette: number[];
    ppu: { mode: number; main: number; sub: number; cgwsel: number; cgadsub: number; fixed: number[] };
    layers: LayerData[];
}

/** A row of `terra://rom/rooms/index.json`. */
export interface RoomEntry { id: number; hex: string; script: number; sections: number[]; sets: number[]; w: number; h: number; context: number[]; key: string }

/** A group of `terra://rom/groups/index.json`. */
export interface GroupData { name: string; pictures: number[][]; noMap: number[] }

export function hex(n: number, digits: number): string {
    let s = n.toString(16).toUpperCase();
    while (s.length < digits) s = '0' + s;
    return s;
}

/** A SNES BG tile word: character, palette, priority, flips. */
export function tileWord(w: number) {
    return { char: w & 0x3FF, palette: (w >> 10) & 7, priority: (w >> 13) & 1, hflip: (w & 0x4000) !== 0, vflip: (w & 0x8000) !== 0 };
}

/**
 * A map word: the metatile (bits 0-8), the cell type (bits 9-13, read by the movement code $80:DA28), bit 14
 * (not decoded) and bit 15 (set while a character stands on the cell, $80:BEC2; 0 in a freshly loaded map).
 */
export function mapWord(w: number) {
    return { metatile: w & 0x1FF, type: (w >> 9) & 0x1F, bit14: (w >> 14) & 1, occupied: (w >> 15) & 1 };
}

export function layerOf(room: RoomData, index: number): LayerData | null {
    return room.layers.find(l => l.index === index) ?? null;
}

/** The map word of `layer` at cell (x, y) of the room; a smaller layer repeats. -1 off the room or without the layer. */
export function cellWord(room: RoomData, index: number, x: number, y: number): number {
    const l = layerOf(room, index);
    if (!l || x < 0 || y < 0 || x >= room.w || y >= room.h) return -1;
    return l.cells[(y % l.h) * l.w + (x % l.w)];
}

/** Where metatile `n` is used in a layer: how many cells, and the cell types those cells carry. */
export function metatileUse(l: LayerData, n: number): { cells: number; types: number[] } {
    let cells = 0;
    const types = new Set<number>();
    for (const w of l.cells) if ((w & 0x1FF) === n) { cells++; types.add(mapWord(w).type); }
    return { cells, types: [...types].sort((a, b) => a - b) };
}

const QUARTERS = ['top left', 'top right', 'bottom left', 'bottom right'];

/** Rows of a 16-wide metatile sheet that hold every metatile the layer's cells use (at least 1). */
export function sheetRows(l: LayerData): number {
    let max = 0;
    for (const w of l.cells) max = Math.max(max, w & 0x1FF);
    return Math.floor(max / 16) + 1;
}

/** The four tile words of metatile `n`, described (one line each). */
export function metatileTiles(l: LayerData, n: number): string[] {
    return QUARTERS.map((q, i) => {
        const w = l.metatiles[n * 4 + i], t = tileWord(w);
        return `${q}: $${hex(w, 4)} · char $${hex(t.char, 3)} · palette ${t.palette} · ${t.priority ? 'high' : 'low'} priority`
            + (t.hflip || t.vflip ? ' · flipped ' + [t.hflip ? 'H' : '', t.vflip ? 'V' : ''].join('') : '');
    });
}

/** What the page says about a cell of layer `index`. */
export function describeCell(room: RoomData, index: number, x: number, y: number): string[] {
    const w = cellWord(room, index, x, y);
    if (w < 0) return [];
    const m = mapWord(w);
    return [
        `cell ${x},${y} · map word $${hex(w, 4)}`,
        `metatile $${hex(m.metatile, 3)} · cell type ${m.type} ($${hex(m.type, 2)})` + (m.bit14 ? ' · bit 14 set' : '') + (m.occupied ? ' · occupied' : ''),
    ];
}

/** Rooms that show `id`'s picture (its variants), id order; [id] when none. */
export function variantsOf(pictures: number[][], id: number): number[] {
    return (pictures.find(p => p.includes(id)) ?? [id]).slice().sort((a, b) => a - b);
}

/** The rail: per group of ids, one row per picture named by its first room, then the rooms without a map. */
export function railAreas(groups: GroupData[], rooms: Map<number, RoomEntry>) {
    return groups.map(g => ({
        area: g.name,
        rooms: g.pictures.map(p => {
            const r = rooms.get(p[0]);
            const size = r ? r.w + '×' + r.h : '';
            return { name: 'Room $' + hex(p[0], 3) + (p.length > 1 ? ' +' + (p.length - 1) : ''), tag: size,
                attrs: { room: p[0], rooms: p.join(' '), hexes: p.map(i => hex(i, 3).toLowerCase()).join(' ') } };
        }),
    }));
}

/** Colour of cell type `t` on the overlay (0, open floor in the rooms looked at, is not drawn). */
export function typeColor(t: number): string {
    return `hsl(${(t * 67) % 360}, 85%, 55%)`;
}

/** The layer 0 cells with a non-zero type, for the overlay: [x, y, type]. */
export function typedCells(room: RoomData): [number, number, number][] {
    const l = layerOf(room, 0), out: [number, number, number][] = [];
    if (!l) return out;
    for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
        const t = mapWord(l.cells[y * l.w + x]).type;
        if (t) out.push([x, y, t]);
    }
    return out;
}

/** The PPU registers as words for the Info tab. */
export function describeDisplay(room: RoomData): string[] {
    const p = room.ppu, bgs = (v: number) => [1, 2, 3, 4].filter(b => (v >> (b - 1)) & 1).map(b => 'BG' + b).join(' ') + ((v & 0x10) ? ' OBJ' : '');
    const math = p.cgadsub & 0x3F
        ? `${p.cgadsub & 0x80 ? 'subtract' : 'add'}${p.cgadsub & 0x40 ? ' half' : ''} ${p.cgwsel & 2 ? 'sub screen' : 'fixed colour'} on `
            + [1, 2, 3, 4].filter(b => (p.cgadsub >> (b - 1)) & 1).map(b => 'BG' + b).concat(p.cgadsub & 0x20 ? ['backdrop'] : []).join(', ')
        : 'none';
    return [`BG mode ${p.mode & 7}`, `main screen: ${bgs(p.main) || '—'}`, `sub screen: ${bgs(p.sub) || '—'}`, `colour math: ${math}`];
}
