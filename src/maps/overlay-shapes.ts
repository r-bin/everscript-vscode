// Ownership: the raster primitives the feature overlay is painted with.
// Pure. Ported from everscript/tools/render_map.py `render_full_composition`.
//
// Split from collision-overlay.ts, which decides *which* passes run and in
// what order; these are the shapes those passes draw. Each one writes straight
// into an RGBA buffer, because the overlay composites onto the rendered map
// rather than producing a separate layer to blend later.

import { passability, geometryMask, OPEN } from './collision';
import { RoomFeatures, PLANE_COLORS } from './overlay-features';

/** Geometry masks sliced into 16 rows of 16 bytes, so a tile stamps by row. */
const GEOMETRY_ROWS: Uint8Array[][] = Array.from({ length: 16 }, (_, code) => {
    const mask = geometryMask(code);
    return Array.from({ length: 16 }, (_, py) => mask.subarray(py * 16, (py + 1) * 16));
});

/** Alpha-blend one pixel into the target buffer. */
export type Blend = (x: number, y: number, r: number, g: number, b: number, a: number) => void;

/** Clamp a coordinate into [0, hi]. */
export function clamp(v: number, hi: number): number { return Math.max(0, Math.min(v, hi)); }

/**
 * Per-plane passability contours plus the dominant plane's wall tint.
 *
 * The engine evaluates collision relative to the plane the entity stands on,
 * so a room with bridges or tunnels has a different walkable map per plane.
 * The dominant plane draws as a solid 2px line and the others as dashes, so
 * overlapping levels read as crossing outlines rather than one blob.
 *
 * `hidden` extends that convention: where it is set the main plane dashes
 * too, using the same pattern. The Rooms tab passes the foreground mask, so a
 * wall the player can see keeps its solid line and one behind the canopy
 * reads like a tunnel — which is what it is from the player's side.
 */
export function drawContours(
    buf: Uint8Array | Uint8ClampedArray,
    blend: Blend,
    wPx: number, hPx: number, wTiles: number, hTiles: number,
    cw: number[][], grassPx: Uint8Array, f: RoomFeatures,
    hidden: Uint8Array | null = null,
): void {
    const planeSolid = new Map<number, Uint8Array>();
    for (const p of f.planes) {
        const mask = new Uint8Array(wPx * hPx);
        for (let r = 0; r < hTiles; r++) {
            const baseY = r * 16;
            for (let c = 0; c < wTiles; c++) {
                const code = passability(cw[r][c], p);
                if (code === OPEN) continue;
                const rows = GEOMETRY_ROWS[code];
                const baseX = c * 16;
                for (let py = 0; py < 16; py++) mask.set(rows[py], (baseY + py) * wPx + baseX);
            }
        }
        planeSolid.set(p, mask);
    }

    // The edge where solid meets open, dilated 3x3 so the line reads at a
    // glance. Grass is transparent to every plane.
    const contour = (mask: Uint8Array): Uint8Array => {
        const edge = new Uint8Array(wPx * hPx);
        for (let y = 0; y < hPx; y++) {
            for (let x = 0; x < wPx; x++) {
                const i = y * wPx + x;
                if (mask[i] !== 1 || grassPx[i]) continue;
                for (const [dy, dx] of NEIGHBOURS) {
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
            for (let x = 0; x < wPx; x++) {
                if (edge[y * wPx + x] !== 1) continue;
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
    for (const p of f.planes) planeBorder.set(p, contour(planeSolid.get(p) as Uint8Array));

    const solid = planeSolid.get(f.mainPlane) as Uint8Array;
    const thickBorder = planeBorder.get(f.mainPlane) as Uint8Array;
    const [mainR, mainG, mainB] = PLANE_COLORS[f.mainPlane] || PLANE_COLORS[1];

    for (let i = 0; i < wPx * hPx; i++) {
        if (solid[i] === 1 && grassPx[i] === 0 && thickBorder[i] === 0) {
            blend(i % wPx, Math.floor(i / wPx), 220, 20, 20, 0.2);
        }
    }
    for (let i = 0; i < wPx * hPx; i++) {
        if (thickBorder[i] !== 1) continue;
        if (hidden && hidden[i] && !inDash(i, wPx)) continue;
        const o = i * 4;
        buf[o] = mainR; buf[o + 1] = mainG; buf[o + 2] = mainB; buf[o + 3] = 255;
    }

    // Secondary planes ride on top as dashes, so a shared boundary shows the
    // dash pattern over the solid line and a tunnel under a bridge reads as
    // two crossing outlines.
    for (const p of f.planes) {
        if (p === f.mainPlane) continue;
        const [pr, pg, pb] = PLANE_COLORS[p] || PLANE_COLORS[1];
        const border = planeBorder.get(p) as Uint8Array;
        for (let i = 0; i < wPx * hPx; i++) {
            if (border[i] === 0) continue;
            if (!inDash(i, wPx)) continue;
            const o = i * 4;
            buf[o] = pr; buf[o + 1] = pg; buf[o + 2] = pb; buf[o + 3] = 255;
        }
    }
}

/** The 3-on/3-off diagonal dash the overlay marks a hidden boundary with. */
function inDash(i: number, wPx: number): boolean {
    return Math.floor((i % wPx + Math.floor(i / wPx)) / 3) % 2 === 0;
}

const NEIGHBOURS: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** Green fill with a merged, opaque contour around each connected grass region. */
export function drawGrass(
    buf: Uint8Array | Uint8ClampedArray,
    blend: Blend,
    wPx: number, hPx: number,
    grassPx: Uint8Array, tiles: Array<[number, number]>,
): void {
    const thickG = new Uint8Array(wPx * hPx);
    for (const [tc, tr] of tiles) {
        for (let py = 0; py < 16; py++) {
            const y = tr * 16 + py;
            for (let px = 0; px < 16; px++) {
                const x = tc * 16 + px;
                for (const [dy, dx] of NEIGHBOURS) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < hPx && nx >= 0 && nx < wPx && grassPx[ny * wPx + nx] !== 0) continue;
                    // Edge pixel: dilate it 3x3 into the contour mask.
                    for (let ey = -1; ey <= 1; ey++) {
                        for (let ex = -1; ex <= 1; ex++) {
                            const gy = y + ey;
                            const gx = x + ex;
                            if (gy >= 0 && gy < hPx && gx >= 0 && gx < wPx) thickG[gy * wPx + gx] = 1;
                        }
                    }
                    break;
                }
            }
        }
    }

    for (const [tc, tr] of tiles) {
        for (let py = 0; py < 16; py++) {
            const y = tr * 16 + py;
            for (let px = 0; px < 16; px++) {
                const x = tc * 16 + px;
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

/** A white drift arrow spanning the tile, with barbed head(s). */
export function drawArrow(blend: Blend, bx: number, by: number, dx: number, dy: number, double: boolean): void {
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    for (let t = -5; t <= 5; t++) blend(bx + 8 + sx * t, by + 8 + sy * t, 255, 255, 255, 0.95);
    for (const hs of double ? [1, -1] : [1]) {
        const tipX = bx + 8 + sx * 5 * hs;
        const tipY = by + 8 + sy * 5 * hs;
        for (const k of [1, 2, 3]) {
            const backX = tipX - sx * k * hs;
            const backY = tipY - sy * k * hs;
            if (sx && sy) {            // diagonal: barbs along each axis
                blend(backX - sx * k, backY, 255, 255, 255, 0.95);
                blend(backX, backY - sy * k, 255, 255, 255, 0.95);
            } else if (sx) {           // horizontal: barbs vertically
                blend(backX, backY - k, 255, 255, 255, 0.95);
                blend(backX, backY + k, 255, 255, 255, 0.95);
            } else {                   // vertical: barbs horizontally
                blend(backX - k, backY, 255, 255, 255, 0.95);
                blend(backX + k, backY, 255, 255, 255, 0.95);
            }
        }
    }
}
