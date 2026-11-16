// Ownership: which cells of a Terranigma room the camera can ever show once the room is an Evermore room, and the
// box around them the conversion keeps (docs/terra/evermore-rooms.md "What the camera shows"). Pure.
//
// Terranigma keeps more in a room's map than the player sees: the blocks map changes copy from (README §3.8), a
// second scene of the same picture, staging rows. The camera follows the player, so what it can show is half a screen
// around every cell the player can stand on. Those cells: walked from where the game's exits arrive (every room's
// exit list), through every cell type some move passes (a ledge jumped down, a slope, a one-way cell), as loaded or
// as a map change leaves it; also every cell of the room's own exits and next to its chests, so a part entered some
// other way (a scripted warp) stays. A room no exit leads into is kept whole.

import * as terra from '../../../terra/decoder';

/** Half of Evermore's 256 x 224 screen in cells, the cell it scrolls into included; vertically one more for where on the Boy the camera centres. */
const HALF_W = 8, HALF_H = 8;
/** Evermore's screen in cells: a box is never cut smaller (where the map is that large). */
const SCREEN_W = 16, SCREEN_H = 14;
/** How far from an arrival point its cell is looked for when the point lies on a wall (as rooms.ts's default start). */
const NEAR = 2;

type Point = { x: number; y: number };
type View = { x: number; y: number; w: number; h: number; seen: Uint8Array; unseen: number };

const arrivalCache = new WeakMap<Uint8Array, Map<number, Point[]>>();

/** Where the game's exits into room `id` put the player (pixels), from every room's exit list. */
function arrivals(rom: Uint8Array, id: number): Point[] {
    let at = arrivalCache.get(rom);
    if (!at) {
        at = new Map();
        for (let k = 0; k < terra.TERRA_ROOM_COUNT; k++) {
            if (!terra.isRoomSlotUsed(rom, k)) continue;
            for (const e of terra.roomExits(rom, k)) for (const t of e.targets) {
                if (!at.has(t.room)) at.set(t.room, []);
                at.get(t.room)!.push({ x: t.x, y: t.y });
            }
        }
        arrivalCache.set(rom, at);
    }
    return at.get(id) ?? [];
}

/**
 * The part of a `w` × `h` map the camera can show: `x`, `y`, `w`, `h` the box kept, `seen` by cell of the box, `unseen`
 * the map's cells left out (cut off or blanked). `passable(x, y)`: some move enters the cell (map coordinates). Null
 * when no exit arrives in the room: nothing to walk from.
 */
function cameraView(rom: Uint8Array, id: number, w: number, h: number, passable: (x: number, y: number) => boolean): View | null {
    const points = arrivals(rom, id);
    if (!points.length) return null;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    const walk = (x: number, y: number) => inside(x, y) && passable(x, y);
    const reached = new Uint8Array(w * h), queue: number[] = [];
    const seed = (x: number, y: number) => { if (walk(x, y) && !reached[y * w + x]) { reached[y * w + x] = 1; queue.push(x, y); } };
    for (const p of points) for (let dy = -NEAR; dy <= NEAR; dy++) for (let dx = -NEAR; dx <= NEAR; dx++) seed((p.x >> 4) + dx, (p.y >> 4) + dy);
    for (const e of terra.roomExits(rom, id)) for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) {
        seed(x, y); seed(x + 1, y); seed(x - 1, y); seed(x, y + 1); seed(x, y - 1);
    }
    for (const c of terra.roomChests(rom, id)) { seed(c.x + 1, c.y); seed(c.x - 1, c.y); seed(c.x, c.y + 1); seed(c.x, c.y - 1); }
    for (let i = 0; i < queue.length; i += 2) {
        const x = queue[i], y = queue[i + 1];
        seed(x + 1, y); seed(x - 1, y); seed(x, y + 1); seed(x, y - 1);
    }
    // Exit cells on walls (a closed door) are not walked: they show while the player stands in front of them.
    const shown = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!reached[y * w + x]) continue;
        for (let yy = Math.max(0, y - HALF_H); yy <= Math.min(h - 1, y + HALF_H); yy++)
            for (let xx = Math.max(0, x - HALF_W); xx <= Math.min(w - 1, x + HALF_W); xx++) shown[yy * w + xx] = 1;
    }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!shown[y * w + x]) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    // Never smaller than a screen: grown on both sides, kept inside the map.
    const grow = (a: number, b: number, min: number, size: number): [number, number] => {
        while (b - a + 1 < Math.min(min, size)) { if (a > 0) a--; if (b - a + 1 < min && b < size - 1) b++; }
        return [a, b];
    };
    [x0, x1] = grow(x0, x1, SCREEN_W, w);
    [y0, y1] = grow(y0, y1, SCREEN_H, h);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, seen = new Uint8Array(bw * bh);
    let kept = 0;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (shown[(y + y0) * w + x + x0]) { seen[y * bw + x] = 1; kept++; }
    return { x: x0, y: y0, w: bw, h: bh, seen, unseen: w * h - kept };
}

export { cameraView, arrivals };
