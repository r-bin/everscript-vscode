// Ownership: a map's collision, cell by cell, in the terms the game's movement code uses.
//
// Each metatile has 4 collision bytes: $CB:0400 + set*384 + half*192 + metatile is an
// index into $CB:0000 (4 bytes each), copied to $7F:B800 (layer A) / $7F:BC00 (B) by
// $02:A043. The player's movement reads layer A's ($01:BA5B, $01:BB5C, $01:BD33 ->
// $01:BE15; $00:D84C for the walker's level):
//   c0 bits 0-2  0 floor of no level, 1 / 2 floor of level 1 / 2, 3 wall, 4-7 no wall.
//                Stepping on 0-2 sets the walker's level ($00:D884); a level-1 floor is
//                solid to a walker on level 2 and the other way round ($01:BE2B).
//   c0 bit 3     changes the walker's level ($00:D868)
//   c1 bit 7     special cell: on load it gets its own metatile slot $C0+k so the game
//                can change it ($00:D05E -> $02:B517): doors, signs, event spots
//   c2           when its high nibble is 1, low bits 4-7 are a diagonal wall
//                (4 bottom-left, 5 top-right, 6 top-left, 7 bottom-right half; $01:BE64-BEF4)
// Other bits (c0 4-7, c1 0-6, c2 other values, c3) are read elsewhere and not named here.

import { Rom, u8 } from './rom';
import { ManaMap } from './map';

const COLLISION_INDEX = 0xCB0400;
const COLLISION_STRUCTS = 0xCB0000;

export type Floor = 0 | 1 | 2 | 3;

export interface MapCollision {
    w: number;
    h: number;
    /** 4 collision bytes per cell, layer A, row by row. */
    bytes: Uint8Array;
}

export function collisionOf(rom: Rom, map: ManaMap): MapCollision {
    const { w, h, header } = map;
    const bytes = new Uint8Array(w * h * 4);
    const base = COLLISION_INDEX + header.metatileSet * 384 + header.halfA * 192;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const n = map.cell('A', x, y);
            if (n < 0 || n >= 192) continue;
            const idx = u8(rom, base + n);
            for (let k = 0; k < 4; k++) bytes[(y * w + x) * 4 + k] = u8(rom, COLLISION_STRUCTS + idx * 4 + k);
        }
    }
    return { w, h, bytes };
}

/** Floor class: 0 none, 1 level 1, 2 level 2, 3 wall (c0 values 4-7 count as none). */
export function floorOf(c0: number): Floor {
    const v = c0 & 7;
    return v < 4 ? (v as Floor) : 0;
}

/** Diagonal wall shape 4-7, or 0. */
export function diagonalOf(c2: number): number {
    return (c2 & 0xF0) === 0x10 && (c2 & 7) >= 4 ? c2 & 7 : 0;
}

export function switchesLevel(c0: number): boolean {
    return (c0 & 0x08) !== 0;
}

/** c1 of a special cell (bit 7 set), else 0. */
export function specialOf(c1: number): number {
    return c1 & 0x80 ? c1 : 0;
}
