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
 *
 * Without `hidden` this is the upstream drawing, kept byte-for-byte because
 * `checkOverlayParity` compares it: the dominant plane as a solid 3px line
 * and the others as dashes.
 *
 * With `hidden` the two meanings that were sharing the dash are separated.
 * **Colour says which plane** and **weight says whether the player can see
 * it**: every plane draws solid in its own colour, 3px where the room's
 * foreground leaves it visible and 2px where the foreground covers it. A
 * dash then no longer means two different things at once, which is what made
 * a covered diagonal read as a visible one.
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

    // The edge where solid meets open, at two weights: 2x2 for a boundary the
    // foreground hides and 3x3 for one the player can see. A single pixel
    // would be the clearer contrast but disappears when the tab scales a
    // 1300px room into a 520px panel. Grass is transparent to every plane.
    const contour = (mask: Uint8Array): { thin: Uint8Array; thick: Uint8Array } => {
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
        const thin = Uint8Array.from(edge);
        const thick = Uint8Array.from(edge);
        for (let y = 0; y < hPx; y++) {
            for (let x = 0; x < wPx; x++) {
                if (edge[y * wPx + x] !== 1) continue;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny < 0 || ny >= hPx || nx < 0 || nx >= wPx) continue;
                        thick[ny * wPx + nx] = 1;
                        if (dy >= 0 && dx >= 0) thin[ny * wPx + nx] = 1;
                    }
                }
            }
        }
        return { thin, thick };
    };

    const planeBorder = new Map<number, { thin: Uint8Array; thick: Uint8Array }>();
    for (const p of f.planes) planeBorder.set(p, contour(planeSolid.get(p) as Uint8Array));

    // The dominant plane's wall tint, everywhere its own line does not reach.
    const solid = planeSolid.get(f.mainPlane) as Uint8Array;
    const mainBorder = planeBorder.get(f.mainPlane) as { thin: Uint8Array; thick: Uint8Array };
    for (let i = 0; i < wPx * hPx; i++) {
        if (solid[i] === 1 && grassPx[i] === 0 && mainBorder.thick[i] === 0) {
            blend(i % wPx, Math.floor(i / wPx), 220, 20, 20, 0.2);
        }
    }

    // Dominant plane first, the rest over it, so a shared boundary shows the
    // upper level — which is the one the player is looking at.
    const order = [f.mainPlane].concat(f.planes.filter((p) => p !== f.mainPlane));
    for (const p of order) {
        const [pr, pg, pb] = PLANE_COLORS[p] || PLANE_COLORS[1];
        const border = planeBorder.get(p) as { thin: Uint8Array; thick: Uint8Array };
        for (let i = 0; i < wPx * hPx; i++) {
            if (hidden) {
                // Weight carries the visibility, so both planes stay solid.
                // A covered line is also blended rather than written flat:
                // two pixels against three is a thin difference once the tab
                // has scaled the room down, and the wash is what makes it
                // read at a glance.
                if (hidden[i]) {
                    if (border.thin[i] === 0) continue;
                    blend(i % wPx, Math.floor(i / wPx), pr, pg, pb, 0.6);
                    continue;
                }
                if (border.thick[i] === 0) continue;
            } else if (p === f.mainPlane) {
                if (border.thick[i] === 0) continue;
            } else {
                if (border.thick[i] === 0 || !inDash(i, wPx)) continue;
            }
            const o = i * 4;
            buf[o] = pr; buf[o + 1] = pg; buf[o + 2] = pb; buf[o + 3] = 255;
        }
    }
}

/** The 3-on/3-off diagonal dash a secondary plane is drawn with upstream. */
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
