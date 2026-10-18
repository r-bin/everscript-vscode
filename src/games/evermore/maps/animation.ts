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

import type { RoomData } from './room';
import { read16 } from './rom';
import { PixelBuffer } from './render';

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

/**
 * The overlay on its own, as a transparent RGBA image.
 *
 * The same two probes as `buildOverlayTransfer`, solved for what was drawn:
 * `alpha = 1 - (atFull - atZero) / 255` and `colour = atZero / alpha`. Used
 * where the marks have to sit *above* something the render never saw — a
 * drafted room's painted cells, which the editor draws in its own layer.
 */
export function overlayLayer(width: number, height: number, paint: (image: PixelBuffer) => void): PixelBuffer {
    const t = buildOverlayTransfer(width, height, paint);
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        let spread = 0;
        for (let c = 0; c < 3; c++) spread = Math.max(spread, t.atFull[i * 3 + c] - t.atZero[i * 3 + c]);
        const alpha = 1 - spread / 255;
        if (alpha <= 0) continue;
        for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.min(255, Math.round(t.atZero[i * 3 + c] / alpha));
        data[i * 4 + 3] = Math.round(alpha * 255);
    }
    return { width, height, data };
}
