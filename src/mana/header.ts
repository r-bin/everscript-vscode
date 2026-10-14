// Ownership: the 8-byte map header, read the way the map loader at $00:C481 reads it.
//
// $C8:7000 + id*2 is a 16-bit pointer into bank $C8 to the header. $00:C481
// hands the bytes to these routines (only what the game was seen doing is named):
//   byte 0 -> $1C for $01:F403: BG character list (& $3F, $01:F413) and,
//             as a whole byte, the animated-tile slot ($01:F5CE)
//   byte 1 -> $1B: palette set (& $7F, $01:F62D)
//   byte 2 -> $1C for $02:A000: metatile + collision set (& $3F); bits 6 and 7
//             pick which half of the 384 metatiles layers A and B use. $02:A000
//             tests them with a 16-bit BIT $1B, so N/V are bits 7/6 of $1C.
//   byte 5 -> $30: display mode (& $3F, row of the table at $C8:0100, $02:AA60)
// Bytes 3, 4, 6, 7 go to other routines and are kept raw.

import { Rom, u8, u16 } from './rom';

export const MAP_COUNT = 512;                 // $C8:5000 holds 513 pointers (512 maps + end)
const HEADER_POINTERS = 0xC87000;

export interface ManaHeader {
    id: number;
    bytes: number[];
    charSet: number;        // byte 0 & $3F
    animSlot: number;       // byte 0
    paletteSet: number;     // byte 1 & $7F
    halfA: 0 | 1;           // byte 2 bit 6: metatile half of layer A (BG1)
    halfB: 0 | 1;           // byte 2 bit 7: metatile half of layer B (BG2)
    metatileSet: number;    // byte 2 & $3F
    display: number;        // byte 5 & $3F
}

export function headerAddress(rom: Rom, id: number): number {
    return 0xC80000 | u16(rom, HEADER_POINTERS + id * 2);
}

export function readHeader(rom: Rom, id: number): ManaHeader {
    const at = headerAddress(rom, id);
    const bytes: number[] = [];
    for (let i = 0; i < 8; i++) bytes.push(u8(rom, at + i));
    return {
        id,
        bytes,
        charSet: bytes[0] & 0x3F,
        animSlot: bytes[0],
        paletteSet: bytes[1] & 0x7F,
        halfA: (bytes[2] & 0x40) ? 1 : 0,
        halfB: (bytes[2] & 0x80) ? 1 : 0,
        metatileSet: bytes[2] & 0x3F,
        display: bytes[5] & 0x3F,
    };
}
