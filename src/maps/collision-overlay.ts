// Ownership: the collision/feature visualization drawn over a rendered room.
// Pure. Ported from everscript/tools/render_map.py `render_collision_overlay`.
// See docs/map-format/map_collision_mechanics.md.
//
// Everything here is classified from documented collision bits — nothing keys
// off a room id or a hand-built word list. Draw order matters and matches
// upstream, because later passes deliberately paint over earlier ones.
//
// Not ported: the text labels, legend banner and header banner, which need the
// 3x5/7x7 bitmap fonts. The extension draws its own interactive labels in SVG
// instead, so the raster stays purely graphical.

import { RoomData } from './room';
import { PixelBuffer } from './render';
import {
    passability,
    tilePlane,
    planesUsed,
    planeTransitionTiles,
    isAlwaysWalkable,
    isPlaneTransparent,
    entityGate,
    driftVector,
    geometryMask,
    SOLID,
    OPEN,
} from './collision';

/** One contour colour per elevation plane, matching render_map.py. */
export const PLANE_COLORS: Record<number, [number, number, number]> = {
    0: [0, 170, 255],
    1: [235, 25, 25],
    2: [0, 255, 170],
    3: [190, 90, 255],
};

const GATE_BLOCKS: Record<number, boolean> = { 3: true, 5: true, 7: true };

/** Geometry masks sliced into 16 rows of 16 bytes, so a tile stamps by row. */
const GEOMETRY_ROWS: Uint8Array[][] = Array.from({ length: 16 }, (_, code) => {
    const mask = geometryMask(code);
    return Array.from({ length: 16 }, (_, py) => mask.subarray(py * 16, (py + 1) * 16));
});

export interface CollisionOverlayOptions {
    /** Draw the blue object-stamp boxes. Default true. */
    objects?: boolean;
    /** Draw the green cuttable-grass fill and contour. Default true. */
    grass?: boolean;
    /**
     * Draw the magenta step-on and yellow B-trigger boxes. Default **false**.
     *
     * Upstream bakes these into the image; the Rooms tab draws its own
     * interactive SVG trigger boxes on top, so baking them too would double
     * every trigger. Enable it for parity against render_full_composition.
     */
    triggers?: boolean;
}

/**
 * Blend the collision visualization into an existing composite, in place.
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

    const blend = (x: number, y: number, r: number, g: number, b: number, alpha: number): void => {
        if (x < 0 || y < 0 || x >= wPx || y >= hPx) return;
        const o = (y * wPx + x) * 4;
        const inv = 1 - alpha;
        buf[o] = Math.trunc(r * alpha + buf[o] * inv);
        buf[o + 1] = Math.trunc(g * alpha + buf[o + 1] * inv);
        buf[o + 2] = Math.trunc(b * alpha + buf[o + 2] * inv);
        buf[o + 3] = 255;
    };

    // 1. Cuttable grass is a temporary barrier, not map geometry, so it is
    //    excluded from every plane's contour.
    const grassPx = new Uint8Array(wPx * hPx);
    const grassTiles = room.cuttableGrass.tiles;
    for (const [tx, ty] of grassTiles) {
        for (let py = 0; py < 16; py++) {
            const off = (ty * 16 + py) * wPx + tx * 16;
            grassPx.fill(1, off, off + 16);
        }
    }

    // 2. Per-plane solid masks, evaluated as $909DE8 would for an entity
    //    standing on that plane.
    const planes = planesUsed(cw);
    const planeSolid = new Map<number, Uint8Array>();
    const planeWalkable = new Map<number, number>();
    for (const p of planes) {
        const mask = new Uint8Array(wPx * hPx);
        let walkable = 0;
        for (let r = 0; r < hTiles; r++) {
            const baseY = r * 16;
            for (let c = 0; c < wTiles; c++) {
                const code = passability(cw[r][c], p);
                if (code !== SOLID) walkable += 1;
                if (code === OPEN) continue;
                const rows = GEOMETRY_ROWS[code];
                const baseX = c * 16;
                for (let py = 0; py < 16; py++) mask.set(rows[py], (baseY + py) * wPx + baseX);
            }
        }
        planeSolid.set(p, mask);
        planeWalkable.set(p, walkable);
    }

    const mainPlane = planes.reduce((a, b) => ((planeWalkable.get(b) || 0) > (planeWalkable.get(a) || 0) ? b : a), planes[0] ?? 0);
    const solid = planeSolid.get(mainPlane) || new Uint8Array(wPx * hPx);

    // 3. Special-terrain sets, straight out of the collision bits.
    const forcedWalk: Array<[number, number]> = [];
    const transparent: Array<[number, number]> = [];
    const gated: Array<[number, number]> = [];
    for (let r = 0; r < hTiles; r++) {
        for (let c = 0; c < wTiles; c++) {
            const word = cw[r][c];
            if (isAlwaysWalkable(word)) forcedWalk.push([c, r]);
            if (isPlaneTransparent(word)) transparent.push([c, r]);
            if (GATE_BLOCKS[entityGate(word)]) gated.push([c, r]);
        }
    }
    const transitions = planeTransitionTiles(cw);

    // 4. Contour each plane: the edge where solid meets open, then dilated so
    //    the line reads at a glance. Grass is transparent to all planes.
    const contour = (mask: Uint8Array): Uint8Array => {
        const edge = new Uint8Array(wPx * hPx);
        for (let y = 0; y < hPx; y++) {
            const yOff = y * wPx;
            for (let x = 0; x < wPx; x++) {
                const i = yOff + x;
                if (mask[i] !== 1 || grassPx[i]) continue;
                for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as Array<[number, number]>) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny < 0 || ny >= hPx || nx < 0 || nx >= wPx) continue;
                    const n = ny * wPx + nx;
                    if (mask[n] === 0 && grassPx[n] === 0) { edge[i] = 1; break; }
                }
            }
        }
        const thick = Uint8Array.from(edge);
        for (let y = 0; y < hPx; y++) {
            const yOff = y * wPx;
            for (let x = 0; x < wPx; x++) {
                if (edge[yOff + x] !== 1) continue;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny >= 0 && ny < hPx && nx >= 0 && nx < wPx) thick[ny * wPx + nx] = 1;
                    }
                }
            }
        }
        return thick;
    };

    const planeBorder = new Map<number, Uint8Array>();
    for (const p of planes) planeBorder.set(p, contour(planeSolid.get(p) as Uint8Array));
    const thickBorder = planeBorder.get(mainPlane) || new Uint8Array(wPx * hPx);

    // 5. Solid tint on the dominant plane's walls, then its contour on top.
    const [mainR, mainG, mainB] = PLANE_COLORS[mainPlane] || PLANE_COLORS[1];
    for (let i = 0; i < wPx * hPx; i++) {
        if (solid[i] === 1 && grassPx[i] === 0 && thickBorder[i] === 0) {
            blend(i % wPx, Math.floor(i / wPx), 220, 20, 20, 0.2);
        }
    }
    for (let i = 0; i < wPx * hPx; i++) {
        if (thickBorder[i] !== 1) continue;
        const o = i * 4;
        buf[o] = mainR; buf[o + 1] = mainG; buf[o + 2] = mainB; buf[o + 3] = 255;
    }

    // Secondary planes ride on top as dashes, so a shared boundary shows the
    // dash pattern over the solid line and a tunnel under a bridge reads as
    // two crossing outlines.
    for (const p of planes) {
        if (p === mainPlane) continue;
        const [pr, pg, pb] = PLANE_COLORS[p] || PLANE_COLORS[1];
        const border = planeBorder.get(p) as Uint8Array;
        for (let i = 0; i < wPx * hPx; i++) {
            if (border[i] === 0) continue;
            const y = Math.floor(i / wPx);
            const x = i % wPx;
            if (Math.floor((x + y) / 3) % 2) continue;
            const o = i * 4;
            buf[o] = pr; buf[o + 1] = pg; buf[o + 2] = pb; buf[o + 3] = 255;
        }
    }

    // 6. Forced-walkable tiles (bit 13): cyan wash plus a drift arrow. Under
    //    bit 13 the low nibble is a direction index, not geometry.
    const drawArrow = (bx: number, by: number, dx: number, dy: number, double = false): void => {
        const sx = Math.sign(dx);
        const sy = Math.sign(dy);
        for (let t = -5; t <= 5; t++) blend(bx + 8 + sx * t, by + 8 + sy * t, 255, 255, 255, 0.95);
        const heads = double ? [1, -1] : [1];
        for (const hs of heads) {
            const tipX = bx + 8 + sx * 5 * hs;
            const tipY = by + 8 + sy * 5 * hs;
            for (const k of [1, 2, 3]) {
                const backX = tipX - sx * k * hs;
                const backY = tipY - sy * k * hs;
                if (sx && sy) {
                    blend(backX - sx * k, backY, 255, 255, 255, 0.95);
                    blend(backX, backY - sy * k, 255, 255, 255, 0.95);
                } else if (sx) {
                    blend(backX, backY - k, 255, 255, 255, 0.95);
                    blend(backX, backY + k, 255, 255, 255, 0.95);
                } else {
                    blend(backX - k, backY, 255, 255, 255, 0.95);
                    blend(backX + k, backY, 255, 255, 255, 0.95);
                }
            }
        }
    };

    for (const [tc, tr] of forcedWalk) {
        const bx = tc * 16;
        const by = tr * 16;
        for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) blend(bx + px, by + py, 0, 188, 212, 0.34);
        const d = driftVector(cw[tr][tc]);
        if (d.name.startsWith('SHEAR')) {
            // Direction depends on the entity's own motion, not the map, so
            // draw a double-headed diagonal rather than a single arrow.
            const sign = d.name.endsWith('+') ? 1 : -1;
            drawArrow(bx, by, 1, -sign, true);
        } else if (d.name) {
            drawArrow(bx, by, d.dx, d.dy);
        }
    }

    // 7. Plane-transparent tiles (bit 6): purple wash.
    for (const [tc, tr] of transparent) {
        const bx = tc * 16;
        const by = tr * 16;
        for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) blend(bx + px, by + py, 156, 39, 176, 0.3);
    }

    // 8. Elevation-change tiles: amber wash with step rungs.
    for (const [tc, tr] of transitions) {
        const bx = tc * 16;
        const by = tr * 16;
        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                if ((py === 3 || py === 7 || py === 11 || py === 15) && px >= 2 && px <= 13) {
                    blend(bx + px, by + py, 255, 220, 50, 0.9);
                } else {
                    blend(bx + px, by + py, 255, 152, 0, 0.34);
                }
            }
        }
    }

    // 9. Entity-gated tiles (bit 8): the dashed light border. Gate 3 is solid
    //    for everything but the boy and dog, 5 for the dog, 7 for both.
    for (const [tc, tr] of gated) {
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

    // 10. Object stamps: soft blue tint with a 1px perimeter.
    if (opts.objects !== false) {
        for (const obj of room.objects) {
            for (const st of obj.states) {
                const x1 = st.tileX * 16;
                const y1 = st.tileY * 16;
                const x2 = (st.tileX + Math.max(st.targetWidth, 1)) * 16 - 1;
                const y2 = (st.tileY + Math.max(st.targetHeight, 1)) * 16 - 1;
                for (let y = y1; y <= y2; y++) {
                    for (let x = x1; x <= x2; x++) {
                        if (y < 0 || y >= hPx || x < 0 || x >= wPx) continue;
                        const edge = y === y1 || y === y2 || x === x1 || x === x2;
                        blend(x, y, 33, 150, 243, edge ? 0.9 : 0.32);
                    }
                }
            }
        }
    }

    // 11. Cuttable grass: soft green fill plus a dilated contour, in the same
    //     outlined-box style as the wall boundary. Adjacent grass merges.
    if (opts.grass !== false && grassTiles.length) {
        const gEdge: number[] = [];
        for (const [tc, tr] of grassTiles) {
            const bx = tc * 16;
            const by = tr * 16;
            for (let py = 0; py < 16; py++) {
                const y = by + py;
                for (let px = 0; px < 16; px++) {
                    const x = bx + px;
                    for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as Array<[number, number]>) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny < 0 || ny >= hPx || nx < 0 || nx >= wPx || grassPx[ny * wPx + nx] === 0) {
                            gEdge.push(y * wPx + x);
                            break;
                        }
                    }
                }
            }
        }

        const thickG = new Uint8Array(wPx * hPx);
        for (const i of gEdge) {
            const y = Math.floor(i / wPx);
            const x = i % wPx;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < hPx && nx >= 0 && nx < wPx) thickG[ny * wPx + nx] = 1;
                }
            }
        }

        for (const [tc, tr] of grassTiles) {
            const bx = tc * 16;
            const by = tr * 16;
            for (let py = 0; py < 16; py++) {
                const y = by + py;
                for (let px = 0; px < 16; px++) {
                    const x = bx + px;
                    if (!thickG[y * wPx + x]) blend(x, y, 76, 175, 80, 0.28);
                }
            }
        }
        // The contour is written opaque, not blended, so it stays crisp.
        for (let i = 0; i < wPx * hPx; i++) {
            if (!thickG[i]) continue;
            const o = i * 4;
            buf[o] = 60; buf[o + 1] = 225; buf[o + 2] = 70; buf[o + 3] = 255;
        }
    }

    // 12. Trigger boxes. Off by default — the Rooms tab draws these as
    //     interactive SVG, and drawing them here too would double them.
    if (opts.triggers) {
        const ox = room.header.originX;
        const oy = room.header.originY;
        const drawBox = (
            x1: number, y1: number, x2: number, y2: number,
            color: [number, number, number, number],
            fill: [number, number, number, number],
        ): void => {
            if (x2 < x1) { const t = x1; x1 = x2; x2 = t; }
            if (y2 < y1) { const t = y1; y1 = y2; y2 = t; }
            x1 = Math.max(0, Math.min(x1, wPx)); x2 = Math.max(0, Math.min(x2, wPx));
            y1 = Math.max(0, Math.min(y1, hPx)); y2 = Math.max(0, Math.min(y2, hPx));
            for (let y = y1; y < y2; y++) {
                for (let x = x1; x < x2; x++) {
                    const border = y === y1 || y === y2 - 1 || x === x1 || x === x2 - 1;
                    const c = border ? color : fill;
                    blend(x, y, c[0], c[1], c[2], c[3] / 255);
                }
            }
        };

        for (const t of room.triggers.bTrigger) {
            drawBox((t.x1 - ox) * 16, (t.y1 - oy) * 16, (t.x2 - ox) * 16, (t.y2 - oy) * 16,
                [255, 255, 0, 255], [255, 255, 0, 85]);
        }
        for (const t of room.triggers.stepOn) {
            drawBox((t.x1 - ox) * 16, (t.y1 - oy) * 16, (t.x2 - ox) * 16, (t.y2 - oy) * 16,
                [255, 0, 255, 255], [255, 0, 255, 85]);
        }
    }

    return image;
}
