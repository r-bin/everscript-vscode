// Ownership: Section 2 animated tiles — the channel/frame table, and the
// per-cell overlays the Rooms tab cycles to make a room move. Pure.
//
// Format: docs/map-format/map_animated_tiles.md (which supersedes §7 of
// map_tile_graphics_decompression.md, corrected against the ROM):
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
//
// Two things the overlay must not do, both learned the hard way on room 0x25:
//
//  - It must carry the feature overlay. Animation frames are bare
//    composites, so an animated cell that also carries a contour, an object
//    box or a label would have that art wiped the moment a frame landed on
//    it. `overlayTransfer` re-applies exactly what the overlay pass did to
//    each pixel, so a torch on a tinted wall both flickers and keeps its
//    markings.
//  - It must be rebuilt when the grid changes. Which channel drives a cell
//    depends on the tilemap word in it, and an object state rewrites that:
//    the firepit in 0x25 runs on channels 6-9 unlit and 0-3 burning. Groups
//    cached across a state change replay the old channels over the new
//    tiles. The caller keys this the same way it keys the render.

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

/** Which render the animation has to match; mirrors the Rooms tab's layer pick. */
export type AnimationLayer = 'composite' | 'layer1' | 'layer2';

export interface AnimationOptions {
    /** Which layer the map image is showing. Default 'composite'. */
    layer?: AnimationLayer;
    /**
     * What the feature overlay did to each pixel of the full room image.
     * Re-applied to every animated pixel so the markings survive.
     */
    overlay?: OverlayTransfer | null;
}

/**
 * What the feature overlay does to each pixel, as a function of what was
 * underneath it.
 *
 * Every overlay pass is either an alpha blend or an opaque write, so per
 * channel the result is affine in the base colour: `out = base*(1-a) + C*a`.
 * Probing the pass with an all-black and an all-white base pins both unknowns
 * exactly — `atZero = C*a` and `atFull = 255*(1-a) + C*a` — so the same mark
 * can be re-applied to an animated pixel the pass never saw.
 *
 * This falls out correctly at both extremes without a special case: an opaque
 * write gives `atZero == atFull` (frozen, as it should be), and an untouched
 * pixel gives `atZero = 0, atFull = 255` (a pure passthrough). A threshold on
 * "how much did this change" would have had to guess where a 20% wall tint
 * ends and a contour line begins, and would have frozen most of a room.
 */
export interface OverlayTransfer {
    /** RGB the overlay produces over black, 3 bytes per pixel. */
    atZero: Uint8Array;
    /** RGB the overlay produces over white, 3 bytes per pixel. */
    atFull: Uint8Array;
}

/**
 * Probe `paint` with a flat black and a flat white image of the given size.
 *
 * `paint` must apply the overlay in place, the same way and with the same
 * options as the visible render, or the animation will carry different
 * markings from the map under it.
 */
export function buildOverlayTransfer(
    width: number,
    height: number,
    paint: (image: PixelBuffer) => void,
): OverlayTransfer {
    const n = width * height;
    const probe = (fill: number): Uint8Array => {
        const data = new Uint8Array(n * 4);
        data.fill(fill);
        for (let i = 3; i < data.length; i += 4) data[i] = 255;
        paint({ width, height, data });
        const rgb = new Uint8Array(n * 3);
        for (let i = 0; i < n; i++) {
            rgb[i * 3] = data[i * 4];
            rgb[i * 3 + 1] = data[i * 4 + 1];
            rgb[i * 3 + 2] = data[i * 4 + 2];
        }
        return rgb;
    };
    return { atZero: probe(0), atFull: probe(255) };
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
    const nPal = room.tilePalette.length;
    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;
    const stride = wTiles * 16;

    // 1. Find animated cells and which channels drive each. Only the words the
    //    chosen layer actually draws count: on an L1-only view, an animated
    //    terrain tile is not on screen and must not be animated over.
    const byKey = new Map<string, { chans: number[]; cells: CellRef[] }>();
    for (let y = 0; y < hTiles; y++) {
        for (let x = 0; x < wTiles; x++) {
            const w1 = room.layer1VramWords[y][x];
            const w2 = room.layer2VramWords[y][x];
            const words = layer === 'layer1' ? [w1] : layer === 'layer2' ? [w2] : [w1, w2];
            const chans: number[] = [];
            for (const w of words) {
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
    return compositeLayers(mini, renderVramLayer(rom, mini, mini.layer1VramWords),
        renderVramLayer(rom, mini, mini.layer2VramWords), { backdrop: [0, 0, 0, 0] });
}
