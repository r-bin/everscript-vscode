// Ownership: the per-channel overlays the Rooms tab cycles to make a room move — cells grouped by
// the channels that drive them, each group's frames rendered over its own bounding box. Pure.
// The channel table and the overlay rules are ./animation.

import type { RoomData } from './room';
import { PixelBuffer, renderVramLayer, compositeLayers } from './render';
import type { OverlayTransfer } from './animation';

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

/**
 * Which render the animation has to match; mirrors the Rooms tab's layer pick.
 * `foreground` is the priority half only (`renderRoomForeground`), for a view
 * that draws characters between the two halves.
 */
export type AnimationLayer = 'composite' | 'layer1' | 'layer2' | 'foreground';

export interface AnimationOptions {
    /** Which layer the map image is showing. Default 'composite'. */
    layer?: AnimationLayer;
    /**
     * What the feature overlay did to each pixel of the full room image.
     * Re-applied to every animated pixel so the markings survive.
     */
    overlay?: OverlayTransfer | null;
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
export function buildAnimationGroups(
    rom: Uint8Array,
    room: RoomData,
    opts: AnimationOptions = {},
): AnimationGroup[] {
    const channels = room.animation;
    if (!channels.length) return [];
    const layer: AnimationLayer = opts.layer || 'composite';
    const overlay = opts.overlay || null;
    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;
    const stride = wTiles * 16;

    // 1. Find animated cells and which channels drive each (cellChannels).
    const byKey = new Map<string, { chans: number[]; cells: CellRef[] }>();
    for (let y = 0; y < hTiles; y++) {
        for (let x = 0; x < wTiles; x++) {
            const chans = cellChannels(room, x, y, layer);
            if (!chans.length) continue;
            const key = chans.join(',');
            let g = byKey.get(key);
            if (!g) { g = { chans, cells: [] }; byKey.set(key, g); }
            g.cells.push({ x, y, w1: room.layer1VramWords[y][x], w2: room.layer2VramWords[y][x] });
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
                    if (!px) { px = renderCell(rom, staged, cell.w1, cell.w2, layer); cellCache.set(ck, px); }
                    const ox = (cell.x - x1) * 16;
                    const oy = (cell.y - y1) * 16;
                    for (let py = 0; py < 16; py++) {
                        const dst = ((oy + py) * bw * 16 + ox) * 4;
                        if (!overlay) {
                            buf.set(px.data.subarray(py * 64, py * 64 + 64), dst);
                            continue;
                        }
                        // Put the overlay's own marks back on top of this
                        // frame, so the tile animates and stays annotated.
                        const row = (cell.y * 16 + py) * stride + cell.x * 16;
                        for (let sx = 0; sx < 16; sx++) {
                            const from = py * 64 + sx * 4;
                            const to = dst + sx * 4;
                            const t = (row + sx) * 3;
                            for (let ch = 0; ch < 3; ch++) {
                                const lo = overlay.atZero[t + ch];
                                const hi = overlay.atFull[t + ch];
                                buf[to + ch] = Math.min(255, Math.max(0,
                                    Math.round(px.data[from + ch] * (hi - lo) / 255 + lo)));
                            }
                            // An overlay mark is opaque; elsewhere the frame's
                            // own alpha decides, so empty tiles stay clear.
                            const marked = overlay.atZero[t] !== 0 || overlay.atZero[t + 1] !== 0 ||
                                overlay.atZero[t + 2] !== 0 || overlay.atFull[t] !== 255 ||
                                overlay.atFull[t + 1] !== 255 || overlay.atFull[t + 2] !== 255;
                            buf[to + 3] = marked ? 255 : px.data[from + 3];
                        }
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

/**
 * The channels that animate cell (x, y), sorted; [] for a still cell. Only
 * the words the chosen layer draws count: on an L1-only view, an animated
 * terrain tile is not on screen and must not be animated over.
 */
export function cellChannels(room: RoomData, x: number, y: number, layer: AnimationLayer = 'composite'): number[] {
    const channels = room.animation;
    const nPal = room.tilePalette.length;
    const w1 = room.layer1VramWords[y][x];
    const w2 = room.layer2VramWords[y][x];
    const words = layer === 'layer1' ? [w1] : layer === 'layer2' ? [w2] : [w1, w2];
    const chans: number[] = [];
    for (const w of words) {
        const c = paletteSlot(w) - nPal;
        if (c >= 0 && c < channels.length && channels[c].frames.length > 1 && chans.indexOf(c) < 0) chans.push(c);
    }
    return chans.sort((a, b) => a - b);
}

/**
 * A copy of `image` (a room-sized render) with every animated cell cleared to
 * transparent. The canopy picture is laid over the animation to cover the
 * characters, and a still copy of an animated canopy tile there — 5008 of
 * the 13338 animated cells ROM-wide have canopy pixels — drew frame 0 over
 * every later frame: a torch burning through a frozen one.
 */
export function clearAnimatedCells(image: PixelBuffer, room: RoomData, layer: AnimationLayer = 'composite'): PixelBuffer {
    const out = { width: image.width, height: image.height, data: image.data.slice() };
    if (!room.animation.length) return out;
    for (let y = 0; y < room.header.heightTiles; y++) {
        for (let x = 0; x < room.header.widthTiles; x++) {
            if (!cellChannels(room, x, y, layer).length) continue;
            for (let py = 0; py < 16; py++) out.data.fill(0, ((y * 16 + py) * image.width + x * 16) * 4, ((y * 16 + py) * image.width + x * 16 + 16) * 4);
        }
    }
    return out;
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
 * Render one 16x16 metatile the same way the chosen layer view renders it.
 *
 * Built as a 1x1 room so the shared renderer handles it — compositing is
 * per-cell (priority bits and colour math never read a neighbour), so a cell
 * rendered alone is identical to the same cell in the full room. The layer
 * branch mirrors the Rooms tab's own, or an L1-only view would get frames
 * with the terrain composited back in.
 */
function renderCell(
    rom: Uint8Array, room: RoomData, w1: number, w2: number, layer: AnimationLayer,
): PixelBuffer {
    const mini: RoomData = {
        ...room,
        header: { ...room.header, widthTiles: 1, heightTiles: 1, widthPixels: 16, heightPixels: 16 },
        layer1VramWords: [[w1]],
        layer2VramWords: [[w2]],
    };
    if (layer === 'layer1') return renderVramLayer(rom, mini, mini.layer1VramWords);
    if (layer === 'layer2') return renderVramLayer(rom, mini, mini.layer2VramWords);
    if (layer === 'foreground') {
        return compositeLayers(mini, renderVramLayer(rom, mini, mini.layer1VramWords),
            renderVramLayer(rom, mini, mini.layer2VramWords), { foregroundOnly: true });
    }
    // The map's own backdrop: a frame with a hole where frame 0 had art showed
    // frame 0 (in the map image beneath) through it.
    return compositeLayers(mini, renderVramLayer(rom, mini, mini.layer1VramWords),
        renderVramLayer(rom, mini, mini.layer2VramWords));
}
