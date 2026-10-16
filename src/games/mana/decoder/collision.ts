// Ownership: a map's collision, cell by cell, in the terms the game's movement code uses.
//
// Each metatile has 4 collision bytes: $CB:0400 + set*384 + half*192 + metatile is an
// index into $CB:0000 (4 bytes each), copied to $7F:B800 (layer A) / $7F:BC00 (B) by
// $02:A043. A walker reads the layer it is on (+$0B bit 7: $00:D759) — movement
// $01:B93E -> $01:BE15 / BC37 / BD33 / BF13, the entered cell $00:D74F ($00:D84C), its
// effect $00:D359. One record per 16px cell; the position inside the cell is used only
// for the diagonals and for rounding wall corners (8px halves). docs/mana/README.md
// "Collision" has the evidence for each line:
//   c0 bits 0-2  0 floor of no level, 1 / 2 floor of level 1 / 2, 3 wall, 4-7 no wall.
//                Stepping on 0-2 sets the walker's level ($00:D884); a level-1 floor is
//                solid to a walker on level 2 and the other way round ($01:BE2B).
//                4-7 (bit 2) also keep the walker's sprite priority ($00:D69A).
//   c0 bit 3     flips the walker to the other layer (+$0B bit 7; $00:D864), never solid
//   c0 bits 4-5  a height ($00-$30) for the small objects at $7E:D000 ($02:C1D7); what
//                those objects are has not been seen. c0 bits 6-7: no reader found.
//   c1 bits 0-2  sprite priority from this cell on, 0 = keep (+$8E: $00:D6A0, $00:F6D6)
//   c1 bit 4     return cell: the party goes back to the saved return point $7E:CE00
//                ($00:D688 -> $00:BBD1 -> $01:CCF5); a wall for other characters ($01:B9CD)
//   c1 bit 6     the party may walk onto this special cell ($01:B9B3)
//   c1 bit 7     special cell: on load it gets its own metatile slot $C0+k so the game
//                can change it ($00:D05E -> $02:B517): doors, signs, event spots
//                c1 bits 3 and 5 are never set in the ROM's maps.
//   c2 $1n       low bits 4-7 are a diagonal wall
//                (4 bottom-left, 5 top-right, 6 top-left, 7 bottom-right half; $01:BE64-BEF4)
//   c2 $2n       stairs / slopes, half speed: $20-$21 vertical, $22-$23 horizontal and rising
//                ($22) or falling ($23) going right ($00:D391)
//   c2 $3n       pushes the walker toward n & 3 (up, down, left, right) by (n >> 2) + 1 px
//                per frame ($00:D3DD): currents, quicksand
//   c2 $Cn       cut by weapon type n: the cell becomes metatile c3 ($01:D376; cuttable.ts)
//   c2 $Fn       strike event: hitting it runs event c3*16 + n ($01:D382, $01:CD95)
//   c2 $4n, $Dn  sound $7n / step event c3*16 + n on entering ($00:D37A, $00:D449);
//                only the non-map $1FF has them. Other c2 values: no reader, never used.
//   c3           the new metatile ($Cn) or the event's high bits ($Dn, $Fn); else 0.

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

/** A metatile's 4 collision bytes in one layer's half (`$02:A043`). */
export function metatileCollision(rom: Rom, map: ManaMap, layer: 'A' | 'B', n: number): number[] {
    const half = layer === 'A' ? map.header.halfA : map.header.halfB;
    const idx = u8(rom, COLLISION_INDEX + map.header.metatileSet * 384 + half * 192 + n);
    return [0, 1, 2, 3].map(k => u8(rom, COLLISION_STRUCTS + idx * 4 + k));
}

/** Per cell, layer A's collision (`$7F:B800`) or layer B's (`$7F:BC00`, repeated with its size). */
export function collisionOf(rom: Rom, map: ManaMap, layer: 'A' | 'B' = 'A'): MapCollision {
    const { w, h, header } = map;
    const bytes = new Uint8Array(w * h * 4);
    const base = COLLISION_INDEX + header.metatileSet * 384 + (layer === 'A' ? header.halfA : header.halfB) * 192;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const n = map.cell(layer, x, y);
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

/** c0 bit 3: the cell flips a walker to the other layer (the name predates that reading). */
export function switchesLevel(c0: number): boolean {
    return (c0 & 0x08) !== 0;
}

/** c1 of a special cell (bit 7 set), else 0. */
export function specialOf(c1: number): number {
    return c1 & 0x80 ? c1 : 0;
}
