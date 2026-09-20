// Ownership: Section 2 animated tiles — the channel/frame table, and the
// per-cell overlays the Rooms tab cycles to make a room move. Pure.
//
// Format (docs/map-format/map_tile_graphics_decompression.md §7, corrected
// here against the ROM):
//
//   [count: 1][len: 2]                       len excludes this 3-byte header
//   count x [delay: 1][frameCount: 1][offset: 2]
//   [0xFF]                                   ends the descriptor table
//   frame data: [delay: 1][tileId: 2] ...
//
// `offset` is relative to the descriptor table, and channel i owns the frames
// from its offset up to the next channel's (the last runs to `len`). The doc
// calls the second descriptor byte a "timer" and says the frame stream is
// 0xFF-terminated; in fact that byte is the channel's frame count and the
// 0xFF ends the descriptor table, not the stream. Verified ROM-wide: the
// first offset lands just past the 0xFF in 95/95 rooms, offsets ascend and
// spans divide by 3 in 1020/1020 channels, the byte span equals
// frameCount * 3 in 1020/1020, and the last channel ends exactly at `len`.
//
// Channels run independently — their periods have no common multiple worth
// speaking of — so there is no global frame counter, and the overlay is built
// per channel rather than as whole-room frames.

import { RoomData } from './room';
import { read16 } from './rom';
import { PixelBuffer, renderVramLayer, compositeLayers } from './render';

export interface AnimationFrame {
    /** How long to hold this frame, in 60Hz ticks. */
    delay: number;
    /** Tile id to load into this channel's VRAM slot. */
    tileId: number;
}

export interface AnimationChannel {
    index: number;
    /** Initial countdown before the channel's first advance. */
    delay: number;
    frames: AnimationFrame[];
}

/** Where a room's Section 2 lives, so its channels can be parsed after decode. */
export interface Section2Ref {
    /** File offset of the descriptor table (Section 2 + 3). */
    table: number;
    count: number;
    /** Byte length of the table plus the frame data. */
    len: number;
}

/** Parse the animation channels. Returns [] for a room with no Section 2. */
export function parseAnimationChannels(rom: Uint8Array, ref: Section2Ref): AnimationChannel[] {
    const out: AnimationChannel[] = [];
    if (!ref || ref.count <= 0 || ref.table + ref.count * 4 > rom.length) return out;

    for (let i = 0; i < ref.count; i++) {
        const e = ref.table + i * 4;
        const delay = rom[e];
        const frameCount = rom[e + 1];
        const offset = read16(rom, e + 2);
        const frames: AnimationFrame[] = [];
        for (let k = 0; k < frameCount; k++) {
            const p = ref.table + offset + k * 3;
            if (p + 3 > rom.length || offset + k * 3 + 3 > ref.len) break;
            frames.push({ delay: rom[p], tileId: read16(rom, p + 1) });
        }
        out.push({ index: i, delay, frames });
    }
    return out;
}

/** SNES frames per second, for turning a tick delay into milliseconds. */
const TICK_MS = 1000 / 60.0988;

/**
 * SNES tilemap character index -> index into the room's tile palette.
 * Mirrors render.ts; duplicated rather than shared because the two files own
 * different things and this is three lines.
 */
function paletteSlot(word: number): number {
    const charIdx = word & 0x03ff;
    return Math.floor(charIdx / 0x20) * 8 + Math.floor((charIdx % 0x20) / 2);
}

/** One animated region: the cells it covers, and the frames they cycle through. */
export interface AnimationGroup {
    /** Bounding box in metatile units. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** Frames, each an RGBA buffer of the bounding box, transparent off-cell. */
    frames: PixelBuffer[];
    /** How long each frame is held, in milliseconds. */
    delaysMs: number[];
    /** Channels driving this group, for reporting. */
    channels: number[];
}

/** A cell's animated slots, keyed so identical cells render once. */
interface CellRef { x: number; y: number; w1: number; w2: number; }

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }
function lcm(a: number, b: number): number { return a / gcd(a, b) * b; }

/** Beyond this the two channels driving one cell are left out of step. */
const MAX_STEPS = 24;

/**
 * Build the per-channel overlays the Rooms tab animates.
 *
 * Cells are grouped by which channels drive them, so each group advances on
 * its own schedule — a torch can flicker while water rolls slowly, which is
 * what the hardware does and what a single global frame counter could not
 * reproduce. Each frame is rendered only over the group's own bounding box
 * and left transparent everywhere else, so it drops straight on top of the
 * base render.
 */
export function buildAnimationGroups(rom: Uint8Array, room: RoomData): AnimationGroup[] {
    const channels = room.animation;
    if (!channels.length) return [];
    const nPal = room.tilePalette.length;
    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;

    // 1. Find animated cells and which channels drive each.
    const byKey = new Map<string, { chans: number[]; cells: CellRef[] }>();
    for (let y = 0; y < hTiles; y++) {
        for (let x = 0; x < wTiles; x++) {
            const w1 = room.layer1VramWords[y][x];
            const w2 = room.layer2VramWords[y][x];
            const chans: number[] = [];
            for (const w of [w1, w2]) {
                const c = paletteSlot(w) - nPal;
                if (c >= 0 && c < channels.length && channels[c].frames.length > 1 && chans.indexOf(c) < 0) {
                    chans.push(c);
                }
            }
            if (!chans.length) continue;
            chans.sort((a, b) => a - b);
            const key = chans.join(',');
            let g = byKey.get(key);
            if (!g) { g = { chans, cells: [] }; byKey.set(key, g); }
            g.cells.push({ x, y, w1, w2 });
        }
    }
    if (!byKey.size) return [];

    const groups: AnimationGroup[] = [];
    // Cells sharing both tilemap words render identically; the median room has
    // 22 such pairs, so this turns thousands of cells into a few dozen renders.
    const cellCache = new Map<string, PixelBuffer>();
    for (const { chans, cells } of byKey.values()) {
        // 2. Step schedule. One channel: its own frames, exactly. Two channels
        //    on one cell (rare — 729 cells ROM-wide): step through the lcm of
        //    their frame counts, which keeps each channel's own order and only
        //    loses the phase between them.
        let steps = chans.reduce((a, c) => lcm(a, channels[c].frames.length), 1);
        if (steps > MAX_STEPS) steps = channels[chans[0]].frames.length;

        // 3. Split the cells into blocks before rendering. A channel's cells
        //    are often scattered across the room (torches down a corridor),
        //    and one bounding box round all of them would be almost entirely
        //    transparent padding — an order of magnitude more pixels than the
        //    animation actually occupies.
        for (const block of blockCells(cells)) {
            let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
            for (const c of block) {
                x1 = Math.min(x1, c.x); y1 = Math.min(y1, c.y);
                x2 = Math.max(x2, c.x + 1); y2 = Math.max(y2, c.y + 1);
            }
            const bw = x2 - x1;
            const bh = y2 - y1;

            const frames: PixelBuffer[] = [];
            const delaysMs: number[] = [];
            for (let s = 0; s < steps; s++) {
                const tiles = room.animatedTiles.slice();
                for (const c of chans) {
                    const f = channels[c].frames;
                    tiles[c] = f[s % f.length].tileId;
                }
                const staged: RoomData = { ...room, animatedTiles: tiles };

                const buf = new Uint8Array(bw * 16 * bh * 16 * 4);
                for (const cell of block) {
                    const ck = s + ':' + cell.w1 + ':' + cell.w2;
                    let px = cellCache.get(ck);
                    if (!px) { px = renderCell(rom, staged, cell.w1, cell.w2); cellCache.set(ck, px); }
                    const ox = (cell.x - x1) * 16;
                    const oy = (cell.y - y1) * 16;
                    for (let py = 0; py < 16; py++) {
                        buf.set(px.data.subarray(py * 64, py * 64 + 64), ((oy + py) * bw * 16 + ox) * 4);
                    }
                }
                frames.push({ width: bw * 16, height: bh * 16, data: buf });

                const lead = channels[chans[0]].frames;
                delaysMs.push(Math.max(16, Math.round(lead[s % lead.length].delay * TICK_MS)));
            }

            groups.push({ x: x1, y: y1, w: bw, h: bh, frames, delaysMs, channels: chans });
        }
    }
    return groups;
}

/** Block side in metatiles: bounds the transparent padding per overlay. */
const BLOCK = 8;

/**
 * Bucket cells into `BLOCK`-sized squares so each overlay stays small.
 *
 * Cells that share a channel but sit at opposite ends of the room become
 * separate overlays rather than one room-sized image that is 99% empty.
 */
function blockCells(cells: CellRef[]): CellRef[][] {
    const buckets = new Map<string, CellRef[]>();
    for (const c of cells) {
        const key = Math.floor(c.x / BLOCK) + ',' + Math.floor(c.y / BLOCK);
        const b = buckets.get(key);
        if (b) b.push(c); else buckets.set(key, [c]);
    }
    return Array.from(buckets.values());
}

/**
 * Composite one 16x16 metatile.
 *
 * Built as a 1x1 room so the shared renderer handles it — compositing is
 * per-cell (priority bits and colour math never read a neighbour), so a cell
 * rendered alone is identical to the same cell in the full room.
 */
function renderCell(rom: Uint8Array, room: RoomData, w1: number, w2: number): PixelBuffer {
    const mini: RoomData = {
        ...room,
        header: { ...room.header, widthTiles: 1, heightTiles: 1, widthPixels: 16, heightPixels: 16 },
        layer1VramWords: [[w1]],
        layer2VramWords: [[w2]],
    };
    return compositeLayers(mini, renderVramLayer(rom, mini, mini.layer1VramWords),
        renderVramLayer(rom, mini, mini.layer2VramWords), { backdrop: [0, 0, 0, 0] });
}
