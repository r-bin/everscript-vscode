// Ownership: rasterize the room feature overlay onto a rendered composite.
// Pure. Ported from everscript/tools/render_map.py `render_full_composition`.
// See docs/map-format/map_collision_mechanics.md.
//
// What each feature *is* lives in overlay-features.ts; this file only paints.
// Draw order matters and matches upstream, because later passes deliberately
// paint over earlier ones — labels go last so nothing covers them.
//
// Not drawn here: the header and legend banners. Upstream grows the PNG to fit
// them; the Rooms tab renders them as HTML instead, so the raster stays exactly
// the size of the map and keeps lining up with the interactive SVG layer.

import { RoomData } from './room';
import { PixelBuffer } from './render';
import { driftVector } from './collision';
import { classifyRoom, RoomFeatures, PLANE_COLORS } from './overlay-features';
import { drawLabelInRect, Rgba8 } from './font';
import { clamp, drawArrow, drawContours, drawGrass } from './overlay-shapes';

export { PLANE_COLORS };

/**
 * Which passes to draw. Every one defaults to **on**: the point of the view is
 * to show everything the room contains, and the Rooms tab's top bar opts out.
 */
export interface CollisionOverlayOptions {
    /** Per-plane passability contours and the dominant plane's wall tint. */
    contours?: boolean;
    /** Forced-walkable tiles (bit 13) and their drift arrows. */
    drift?: boolean;
    /** Plane-transparent tiles (bit 6). */
    transparent?: boolean;
    /** Tiles where crossing swaps your elevation plane. */
    elevation?: boolean;
    /** Entity-gated tiles (bit 8) — the dashed white borders. */
    gates?: boolean;
    /** Cuttable-grass fill and contour. */
    grass?: boolean;
    /** Section 3 object stamps. */
    objects?: boolean;
    /** Step-on and B-trigger boxes. */
    triggers?: boolean;
    /** The 3x5 index labels on object and trigger boxes. */
    labels?: boolean;
}

/** A label queued during a draw pass and flushed after every other pass. */
interface QueuedLabel {
    x1: number; y1: number; x2: number; y2: number;
    text: string; color: Rgba8; anchor: 'top' | 'bottom';
}

/**
 * Blend the feature overlay into an existing composite, in place.
 *
 * The buffer is modified and returned, matching upstream's behaviour of
 * drawing onto the composited map rather than producing a separate layer.
 */
export function drawCollisionOverlay(
    image: PixelBuffer,
    room: RoomData,
    opts: CollisionOverlayOptions = {},
): PixelBuffer {
    const wPx = image.width;
    const hPx = image.height;
    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;
    const cw = room.collisionWords;
    const buf = image.data;
    const on = (flag: boolean | undefined): boolean => flag !== false;
    const f: RoomFeatures = classifyRoom(room);

    const blend = (x: number, y: number, r: number, g: number, b: number, alpha: number): void => {
        if (x < 0 || y < 0 || x >= wPx || y >= hPx) return;
        const o = (y * wPx + x) * 4;
        const inv = 1 - alpha;
        buf[o] = Math.trunc(r * alpha + buf[o] * inv);
        buf[o + 1] = Math.trunc(g * alpha + buf[o + 1] * inv);
        buf[o + 2] = Math.trunc(b * alpha + buf[o + 2] * inv);
        buf[o + 3] = 255;
    };

    const fillTile = (tc: number, tr: number, r: number, g: number, b: number, a: number): void => {
        const bx = tc * 16;
        const by = tr * 16;
        for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) blend(bx + px, by + py, r, g, b, a);
    };

    // 1. Cuttable grass is a temporary barrier, not map geometry, so it is
    //    excluded from every plane's contour — even when the grass pass itself
    //    is switched off, or toggling grass would move the walls.
    const grassPx = new Uint8Array(wPx * hPx);
    for (const [tx, ty] of f.grassTiles) {
        for (let py = 0; py < 16; py++) {
            const off = (ty * 16 + py) * wPx + tx * 16;
            grassPx.fill(1, off, off + 16);
        }
    }

    const labels: QueuedLabel[] = [];

    // 2. Per-plane solid masks, evaluated as $909DE8 would for an entity
    //    standing on that plane, then contoured.
    if (on(opts.contours) && f.planes.length) {
        drawContours(buf, blend, wPx, hPx, wTiles, hTiles, cw, grassPx, f);
    }

    // 3. Forced-walkable tiles (bit 13): cyan wash plus a drift arrow. Under
    //    bit 13 the low nibble is a direction index, not geometry.
    if (on(opts.drift)) {
        for (const [tc, tr] of f.forcedWalk) {
            fillTile(tc, tr, 0, 188, 212, 0.34);
            const d = driftVector(cw[tr][tc]);
            if (d.name.startsWith('SHEAR')) {
                // Direction depends on the entity's own motion, not the map, so
                // draw a double-headed diagonal rather than a single arrow.
                drawArrow(blend, tc * 16, tr * 16, 1, d.name.endsWith('+') ? -1 : 1, true);
            } else if (d.name) {
                drawArrow(blend, tc * 16, tr * 16, d.dx, d.dy, false);
            }
        }
    }

    // 4. Plane-transparent tiles (bit 6): purple wash.
    if (on(opts.transparent)) {
        for (const [tc, tr] of f.transparent) fillTile(tc, tr, 156, 39, 176, 0.3);
    }

    // 5. Elevation-change tiles: amber wash with step rungs.
    if (on(opts.elevation)) {
        for (const [tc, tr] of f.transitions) {
            const bx = tc * 16;
            const by = tr * 16;
            for (let py = 0; py < 16; py++) {
                const rung = (py === 3 || py === 7 || py === 11 || py === 15);
                for (let px = 0; px < 16; px++) {
                    if (rung && px >= 2 && px <= 13) blend(bx + px, by + py, 255, 220, 50, 0.9);
                    else blend(bx + px, by + py, 255, 152, 0, 0.34);
                }
            }
        }
    }

    // 6. Entity-gated tiles (bit 8): dashed light border. Gate 3 is solid for
    //    everything but the boy and dog, 5 for the dog, 7 for both.
    if (on(opts.gates)) {
        for (const [tc, tr] of f.gated) {
            const bx = tc * 16;
            const by = tr * 16;
            for (let i = 0; i < 16; i++) {
                if (i % 4 >= 2) continue;
                blend(bx + i, by, 235, 235, 235, 0.95);
                blend(bx + i, by + 15, 235, 235, 235, 0.95);
                blend(bx, by + i, 235, 235, 235, 0.95);
                blend(bx + 15, by + i, 235, 235, 235, 0.95);
            }
        }
    }

    // 7. Object stamps: soft blue tint with a 1px perimeter, labelled with the
    //    index SoEScriptDumper's `script_all` calls "OBJ n".
    if (on(opts.objects)) {
        for (const { tx, ty, w, h, index } of f.objectRects) {
            const x1 = tx * 16;
            const y1 = ty * 16;
            const x2 = (tx + w) * 16 - 1;
            const y2 = (ty + h) * 16 - 1;
            for (let y = y1; y <= y2; y++) {
                for (let x = x1; x <= x2; x++) {
                    if (y < 0 || y >= hPx || x < 0 || x >= wPx) continue;
                    const edge = y === y1 || y === y2 || x === x1 || x === x2;
                    blend(x, y, 33, 150, 243, edge ? 0.9 : 0.32);
                }
            }
            labels.push({ x1, y1, x2, y2, text: String(index), color: [150, 210, 255, 255], anchor: 'bottom' });
        }
    }

    // 8. Cuttable grass: soft green fill plus a dilated contour, in the same
    //    outlined-box style as the wall boundary. Adjacent grass merges.
    if (on(opts.grass) && f.grassTiles.length) {
        drawGrass(buf, blend, wPx, hPx, grassPx, f.grassTiles);
    }

    // 9. Trigger boxes, labelled with the hex script id `script_all` lists.
    if (on(opts.triggers)) {
        const ox = room.header.originX;
        const oy = room.header.originY;
        const box = (x1: number, y1: number, x2: number, y2: number, c: Rgba8, fill: Rgba8): void => {
            if (x2 < x1) { const t = x1; x1 = x2; x2 = t; }
            if (y2 < y1) { const t = y1; y1 = y2; y2 = t; }
            x1 = clamp(x1, wPx); x2 = clamp(x2, wPx);
            y1 = clamp(y1, hPx); y2 = clamp(y2, hPx);
            for (let y = y1; y < y2; y++) {
                for (let x = x1; x < x2; x++) {
                    const p = (y === y1 || y === y2 - 1 || x === x1 || x === x2 - 1) ? c : fill;
                    blend(x, y, p[0], p[1], p[2], p[3] / 255);
                }
            }
        };
        const kinds: Array<[typeof room.triggers.bTrigger, Rgba8, Rgba8, Rgba8]> = [
            [room.triggers.bTrigger, [255, 255, 0, 255], [255, 255, 0, 85], [255, 255, 140, 255]],
            [room.triggers.stepOn, [255, 0, 255, 255], [255, 0, 255, 85], [255, 160, 255, 255]],
        ];
        for (const [list, stroke, fill, ink] of kinds) {
            for (const t of list) {
                const x1 = (t.x1 - ox) * 16;
                const y1 = (t.y1 - oy) * 16;
                const x2 = (t.x2 - ox) * 16;
                const y2 = (t.y2 - oy) * 16;
                box(x1, y1, x2, y2, stroke, fill);
                labels.push({ x1, y1, x2, y2, text: t.scriptId.toString(16).toUpperCase(), color: ink, anchor: 'top' });
            }
        }
    }

    // 10. Labels last, so no later pass can paint over them.
    if (on(opts.labels)) {
        for (const l of labels) {
            drawLabelInRect(buf, wPx, hPx, l.x1, l.y1, l.x2, l.y2, l.text, l.color, l.anchor);
        }
    }

    return image;
}
