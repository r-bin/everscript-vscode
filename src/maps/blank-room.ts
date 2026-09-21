// Ownership: a room that does not exist in the ROM yet — the starting point
// for "draft a new room". Pure.
//
// Everything the renderer reads has to be present and consistent, which is
// the whole difficulty: a synthetic room with one Block 1 entry renders
// black, because a tilemap word's chr resolves to a slot the tile list does
// not have. Rule 7.1 of building-a-room-from-scratch.md, learned the hard
// way. So a blank room borrows a real room's graphics list and families and
// then overwrites only the grid and the dictionary.
//
// See docs/map-format/building-a-room-from-a-picture.md §7.

import { RoomData, decodeRoom } from './room';
import { MetatileDraft } from './metatiles';
import { planesUsed, passability, tilePlane, OPEN } from './collision';

export interface BlankRoomOptions {
    widthTiles: number;
    heightTiles: number;
    /**
     * The room whose graphics list, families and display registers to
     * borrow. Its grid and dictionary are discarded.
     */
    borrowFrom: number;
    /** The dictionary. Entry 0 is what the whole grid is filled with. */
    stamps?: MetatileDraft[];
}

/** Smallest room the format allows: one stamp, a grid that points at it. */
export const MIN_TILES = 2;

/** Bigger than any vanilla room (0x3c is 127 wide, 0x65 is 99 tall). */
export const MAX_TILES = 128;

/**
 * A floor stamp that is guaranteed to draw, and worth looking at.
 *
 * Taken from the borrowed room's own dictionary rather than invented: its
 * words are known to resolve against that room's graphics list, which a
 * hand-written word is not.
 *
 * The most-placed **walkable** entry, not entry 0 and not simply the most
 * placed. A room's first dictionary entry is wherever the encoder happened
 * to start, and its most-placed one is usually the black surround outside
 * the playable area — both make a new room look broken. The stamp a room
 * places most *and* lets the player stand on is its floor, which is what a
 * blank room should be made of.
 */
function borrowedFloor(room: RoomData): MetatileDraft {
    const { layer1, layer2, collision } = room.metatileSlices;
    const uses = new Int32Array(room.metatileCount);
    for (const row of room.layer1MetatileIds) {
        for (const id of row) {
            const i = Math.floor((id - room.baseMetatile) / 8);
            if (i >= 0 && i < uses.length) uses[i] += 1;
        }
    }
    let best = -1;
    let bestUses = -1;
    for (let i = 0; i < room.metatileCount; i++) {
        const cw = collision[i] ?? 0;
        if (passability(cw, tilePlane(cw)) !== OPEN) continue;
        if (uses[i] > bestUses) { best = i; bestUses = uses[i]; }
    }
    if (best < 0) best = 0; // a room with no walkable tile at all: take what there is
    return { layer1: layer1[best] ?? 0, layer2: layer2[best] ?? 0, collision: collision[best] ?? 0 };
}

/**
 * Build a room that is not in the ROM.
 *
 * The result is an ordinary `RoomData`, so every renderer, the metatile
 * atlas, the budget and the collision overlay all work on it unchanged.
 * `baseMetatile` follows the format's own rule — `width * height * 2` — so
 * the ids the grid holds are the ids an encoder would write.
 */
export function blankRoom(rom: Uint8Array, opts: BlankRoomOptions): RoomData {
    const widthTiles = clamp(opts.widthTiles);
    const heightTiles = clamp(opts.heightTiles);
    const base = decodeRoom(rom, opts.borrowFrom);

    const stamps = opts.stamps && opts.stamps.length ? opts.stamps : [borrowedFloor(base)];
    const baseMetatile = widthTiles * heightTiles * 2;

    const layer1: number[][] = [];
    const layer2: number[][] = [];
    const collisionWords: number[][] = [];
    const metatileIds: number[][] = [];
    for (let r = 0; r < heightTiles; r++) {
        const rowL1: number[] = [];
        const rowL2: number[] = [];
        const rowCw: number[] = [];
        const rowId: number[] = [];
        for (let c = 0; c < widthTiles; c++) {
            rowL1.push(stamps[0].layer1);
            rowL2.push(stamps[0].layer2);
            rowCw.push(stamps[0].collision);
            rowId.push(baseMetatile); // every cell is stamp 0
        }
        layer1.push(rowL1);
        layer2.push(rowL2);
        collisionWords.push(rowCw);
        metatileIds.push(rowId);
    }

    return {
        ...base,
        header: {
            ...base.header,
            widthTiles,
            heightTiles,
            widthPixels: widthTiles * 16,
            heightPixels: heightTiles * 16,
        },
        baseMetatile,
        metatileCount: stamps.length,
        metatileSlices: {
            layer1: stamps.map((s) => s.layer1),
            layer2: stamps.map((s) => s.layer2),
            collision: stamps.map((s) => s.collision),
        },
        layer1MetatileIds: metatileIds,
        layer1VramWords: layer1,
        layer2VramWords: layer2,
        collisionWords,
        // A new room starts with nothing attached. Each of these is a
        // separate editing problem, and an empty one is always valid —
        // see building-a-room-from-scratch.md §8.
        triggers: { stepOn: [], bTrigger: [] },
        objects: [],
        cuttableGrass: {
            table: {
                romOffset: 0, sectionLen: 0, sourceCount: 0,
                records: [], swaps: new Map(), truncated: false,
            },
            tiles: [],
            warnings: [],
        },
        elevationPlanes: planesUsed(collisionWords),
    };
}

function clamp(n: number): number {
    const v = Math.round(Number(n) || 0);
    return Math.max(MIN_TILES, Math.min(MAX_TILES, v));
}

/**
 * Whether a room's numbers are ones an encoder would accept.
 *
 * Returned as a list rather than thrown, because the editor wants to show
 * every problem at once and keep working, not stop at the first.
 */
export function roomProblems(room: RoomData): string[] {
    const out: string[] = [];
    const { widthTiles, heightTiles } = room.header;
    if (widthTiles < MIN_TILES || heightTiles < MIN_TILES) {
        out.push(`a room smaller than ${MIN_TILES}x${MIN_TILES} has no grid to encode`);
    }
    if (room.metatileCount < 1) out.push('a room needs at least one metatile');
    if (room.baseMetatile !== widthTiles * heightTiles * 2) {
        out.push(`baseMetatile is ${room.baseMetatile}, but the grid says `
            + `${widthTiles * heightTiles * 2} — every cell id would be wrong`);
    }
    // Cell 0 must point at dictionary entry 0: the Markov encoder's literal
    // field is zero bits wide there. Rule 7.2.
    const first = room.layer1MetatileIds[0] && room.layer1MetatileIds[0][0];
    if (first !== undefined && first !== room.baseMetatile) {
        out.push('cell (0,0) must use metatile 0 — the encoder has no room to say otherwise');
    }
    return out;
}
