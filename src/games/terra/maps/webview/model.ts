// Ownership: what the Terranigma Maps page knows about a room as plain data — no DOM, unit-tested
// (tests/terra/terra-maps-model.test.mts): reading map and tile words, describing a metatile and a cell,
// the rail's rows, which rooms show the same picture, the cell-type, collision and exit overlays. The page (page.dom.ts) and
// the room files (terra://rom/rooms/<hex>.json, games/terra/resources/room-files.ts) are its two ends.
// Facts: docs/terra/README.md §4.

/** One layer of `<hex>.json`. */
export interface LayerData { index: number; bg: number; w: number; h: number; cells: number[]; metatiles: number[] }

/** Where an exit leads (games/terra/decoder/exits.ts): a room, the arrival pixel, two style bytes, a choice's flag. */
export interface ExitTarget { room: number; x: number; y: number; style: number[]; flag: number | null }

/** An exit: a rectangle in cells and its target, or its choices by event flag. */
export interface ExitData { x: number; y: number; w: number; h: number; targets: ExitTarget[]; inverted: boolean; at: number }

/** `terra://rom/rooms/<hex>.json`. */
export interface RoomData {
    id: number; hex: string; w: number; h: number; script: number | null; context: number[];
    sections: { bit: number; name: string }[]; sets: number[]; display: boolean;
    backdrop: number[]; palette: number[];
    ppu: { mode: number; main: number; sub: number; cgwsel: number; cgadsub: number; fixed: number[] };
    layers: LayerData[];
    exits: ExitData[];
}

export type Move = 'up' | 'down' | 'left' | 'right';
export type CellLook = 'open' | 'wall' | 'diagonal' | 'one-way';

/** A row of `terra://rom/cell-types.json` (games/terra/decoder/collision.ts). */
export interface CellTypeRule {
    type: number;
    moves: Record<Move, 'open' | 'wall' | 'diagonal' | 'gated'>;
    ground: 'open' | 'blocked' | 'flagged'; groundWord: number;
    look: CellLook;
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

const MOVES: Move[] = ['up', 'down', 'left', 'right'];
const ARROW: Record<Move, string> = { up: '↑', down: '↓', left: '←', right: '→' };

/** Cells of layer 0 (the map the movement code reads, $7E:A000) per cell type, by type. */
export function typeCounts(room: RoomData): Map<number, number> {
    const l = layerOf(room, 0), out = new Map<number, number>();
    if (!l) return out;
    for (const w of l.cells) { const t = mapWord(w).type; out.set(t, (out.get(t) ?? 0) + 1); }
    return new Map([...out].sort((a, b) => a[0] - b[0]));
}

/** The layer 0 cells whose type is not open in every direction, for the overlay: [x, y, type]. */
export function collisionCells(room: RoomData, rules: CellTypeRule[]): [number, number, number][] {
    const l = layerOf(room, 0), out: [number, number, number][] = [];
    if (!l || !rules.length) return out;
    for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
        const t = mapWord(l.cells[y * l.w + x]).type;
        if (rules[t] && rules[t].look !== 'open') out.push([x, y, t]);
    }
    return out;
}

/**
 * The edges of a cell a character cannot cross into it, as the overlay draws them: moving up into the cell stops
 * at its bottom edge, and so on. `gated` edges stop the move unless a flag is set.
 */
export function blockedEdges(rule: CellTypeRule): { side: 'top' | 'bottom' | 'left' | 'right'; gated: boolean }[] {
    const side: Record<Move, 'top' | 'bottom' | 'left' | 'right'> = { up: 'bottom', down: 'top', left: 'right', right: 'left' };
    return MOVES.filter(m => rule.moves[m] === 'wall' || rule.moves[m] === 'gated').map(m => ({ side: side[m], gated: rule.moves[m] === 'gated' }));
}

/** One line: what a cell type does to a move into it. */
export function moveSummary(rule: CellTypeRule): string {
    const by = (r: string) => MOVES.filter(m => rule.moves[m] === r).map(m => ARROW[m]).join(' ');
    if (rule.look === 'open') return 'open: every move passes';
    if (rule.look === 'wall') return 'wall: every move stops';
    if (rule.look === 'diagonal') return 'diagonal corner: a move slides along its edge';
    const parts = ['passes ' + by('open'), 'stops ' + by('wall')];
    if (by('gated')) parts.push(by('gated') + ' only while $097C bit 2 is set');
    return parts.filter(p => !/ $/.test(p)).join(' · ');
}

/** The rows of the Collision tab for one type: each direction, then the ground table. */
export function describeType(rule: CellTypeRule): string[] {
    const what = { open: 'passes', wall: 'stops at its edge', diagonal: 'slides along the diagonal', gated: 'stops unless $097C bit 2 is set' };
    const ground = { open: 'can enter', blocked: 'cannot enter', flagged: 'can enter only while $048A bit 15 is set' };
    return MOVES.map(m => `moving ${m} into it ${ARROW[m]}: ${what[rule.moves[m]]}`)
        .concat(`ground table ($80:E11C): $${hex(rule.groundWord, 4)} — characters without bit $0400 ${ground[rule.ground]}`);
}

/** The exits whose rectangle holds cell (x, y), by index. */
export function exitsAt(room: RoomData, x: number, y: number): number[] {
    return (room.exits || []).flatMap((e, i) => x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h ? [i] : []);
}

/** The short label of an exit's target(s): `$010`, or `$010 / $011` for choices. */
export function exitTargets(e: ExitData): string {
    return e.targets.map(t => '$' + hex(t.room, 3)).join(' / ') || 'none';
}

/** The rows of the Trigger tab for one exit. */
export function describeExit(e: ExitData): string[] {
    const rows = [`cells ${e.x},${e.y} · ${e.w}×${e.h} · record $${hex(e.at >> 16, 2)}:${hex(e.at & 0xFFFF, 4)}`];
    for (const t of e.targets) {
        const when = t.flag === null ? '' : t.flag === 0 ? 'otherwise: ' : `flag $${hex(t.flag, 3)} ${e.inverted ? 'clear' : 'set'}: `;
        rows.push(`${when}room $${hex(t.room, 3)} at ${t.x},${t.y} (cell ${t.x >> 4},${t.y >> 4}) · style $${hex(t.style[0], 2)} $${hex(t.style[1], 2)}`);
    }
    if (e.targets.length && e.targets[e.targets.length - 1].flag) rows.push('no flag matches: no exit');
    return rows;
}
