// Ownership: showing a room's objects in a chosen state — stamp the deltas
// into the grid, and render one state on its own for a thumbnail. Pure.
//
// See ./object-stamps for the record format and the trace it came from. The
// short version: a state descriptor is an XOR delta from state s to state
// s+1, so state 0 is the grid as decoded and state s is the grid with deltas
// 0..s-1 applied in order.

import { RoomData, RoomObject } from './room';
import { PixelBuffer, renderVramLayer, compositeLayers, RenderOptions } from './render';
import { parseObjectStamp } from './object-stamps';

/** Which state each object index is shown in. Absent means state 0. */
export type ObjectStateMap = Record<number, number>;

/** The state a room loads with: the engine zeroes the state table on map load. */
export const DEFAULT_OBJECT_STATE = 0;

/**
 * How many appearances an object has.
 *
 * One more than its descriptor count, because each descriptor is a transition
 * rather than a state — `max_state` deltas connect `max_state + 1` states.
 */
export function objectStateCount(obj: RoomObject): number {
    return obj.states.length + 1;
}

/** Resolve a metatile ID through Block 3, exactly as decodeRoom does. */
function resolve(room: RoomData, metaId: number): { l1: number; l2: number; coll: number } {
    const idx = Math.floor((metaId - room.baseMetatile) / 8);
    if (idx < 0 || idx >= room.metatileCount) return { l1: 0, l2: 0, coll: 0 };
    const s = room.metatileSlices;
    return { l1: s.layer1[idx] ?? 0, l2: s.layer2[idx] ?? 0, coll: s.collision[idx] ?? 0 };
}

/** The union of every footprint an object's descriptors touch. */
export function objectBounds(rom: Uint8Array, room: RoomData, obj: RoomObject): {
    x: number; y: number; w: number; h: number;
} | null {
    let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
    for (const st of obj.states) {
        const stamp = parseObjectStamp(rom, room.objectArea, st.metatileId);
        if (!stamp.valid) continue;
        x1 = Math.min(x1, st.tileX);
        y1 = Math.min(y1, st.tileY);
        x2 = Math.max(x2, st.tileX + stamp.tw);
        y2 = Math.max(y2, st.tileY + stamp.th);
    }
    if (!isFinite(x1)) return null;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Apply each object's chosen state to a copy of the room's grids.
 *
 * Deltas are cumulative and XOR, so reaching state `s` means applying
 * descriptors 0..s-1 in order — the same walk `$90A44B` does one frame at a
 * time. Collision comes along for free: it is looked up from the same
 * metatile ID as the graphics.
 */
export function applyObjectStates(rom: Uint8Array, room: RoomData, states: ObjectStateMap): RoomData {
    const wanted = Object.keys(states).map(Number).filter((i) => states[i] > DEFAULT_OBJECT_STATE);
    if (!wanted.length) return room;

    const meta = room.layer1MetatileIds.map((r) => r.slice());
    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;
    let touched = false;

    for (const objIndex of wanted) {
        const obj = room.objects[objIndex];
        if (!obj) continue;
        const target = Math.min(states[objIndex], obj.states.length);
        for (let s = 0; s < target; s++) {
            const st = obj.states[s];
            const stamp = parseObjectStamp(rom, room.objectArea, st.metatileId);
            if (!stamp.valid) continue;
            for (let k = 0; k < stamp.deltas.length; k++) {
                const d = stamp.deltas[k];
                if (d === null) continue;
                const tx = st.tileX + (k % stamp.tw);
                const ty = st.tileY + Math.floor(k / stamp.tw);
                if (tx < 0 || ty < 0 || tx >= wTiles || ty >= hTiles) continue;
                meta[ty][tx] ^= d;
                touched = true;
            }
        }
    }
    if (!touched) return room;

    // Re-resolve only what changed; every other cell keeps its decoded words.
    const l1 = room.layer1VramWords.map((r) => r.slice());
    const l2 = room.layer2VramWords.map((r) => r.slice());
    const coll = room.collisionWords.map((r) => r.slice());
    for (let y = 0; y < hTiles; y++) {
        for (let x = 0; x < wTiles; x++) {
            if (meta[y][x] === room.layer1MetatileIds[y][x]) continue;
            const r = resolve(room, meta[y][x]);
            l1[y][x] = r.l1;
            l2[y][x] = r.l2;
            coll[y][x] = r.coll;
        }
    }

    return { ...room, layer1MetatileIds: meta, layer1VramWords: l1, layer2VramWords: l2, collisionWords: coll };
}

/**
 * Render one object in one state, cropped to everything that object can
 * touch — so the thumbnails for its states line up and can be compared.
 *
 * The surrounding terrain is included rather than masked out: a chest lid or
 * an extended bridge only reads as what it is in context.
 */
export function renderObjectState(
    rom: Uint8Array,
    room: RoomData,
    objIndex: number,
    state: number,
    opts: RenderOptions = {},
): PixelBuffer | null {
    const obj = room.objects[objIndex];
    if (!obj) return null;
    const box = objectBounds(rom, room, obj);
    if (!box || box.w <= 0 || box.h <= 0) return null;

    const staged = applyObjectStates(rom, room, { [objIndex]: state });
    const l1: number[][] = [];
    const l2: number[][] = [];
    for (let y = 0; y < box.h; y++) {
        const r1: number[] = [];
        const r2: number[] = [];
        for (let x = 0; x < box.w; x++) {
            const gy = box.y + y;
            const gx = box.x + x;
            const inside = gy >= 0 && gy < room.header.heightTiles && gx >= 0 && gx < room.header.widthTiles;
            r1.push(inside ? staged.layer1VramWords[gy][gx] : 0);
            r2.push(inside ? staged.layer2VramWords[gy][gx] : 0);
        }
        l1.push(r1);
        l2.push(r2);
    }

    const mini: RoomData = {
        ...staged,
        header: {
            ...room.header,
            widthTiles: box.w,
            heightTiles: box.h,
            widthPixels: box.w * 16,
            heightPixels: box.h * 16,
        },
        layer1VramWords: l1,
        layer2VramWords: l2,
    };
    return compositeLayers(mini, renderVramLayer(rom, mini, l1), renderVramLayer(rom, mini, l2), opts);
}
