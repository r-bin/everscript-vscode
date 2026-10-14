// Ownership: the BG palettes a map loads, as $01:F62D does, and the display mode of $02:AA60.
//
// $01:F62D: palette set s is 210 bytes at $CC:8000 + s*210: BG palettes 1-7,
// colours 1-15 each (BGR555 words). Palette 0 (and every colour 0) is cleared.
// $02:AA60: display mode d is 9 bytes at $C8:0100 + d*9. Byte 1 goes to TM,
// byte 2 to TS, byte 3 to CGADSUB; CGWSEL is always $02 (add the sub screen);
// bytes 7-8 become colour 0, the backdrop ($02:AA8C stores them at $0600).

import { Rom, u8, u16 } from './rom';

const PALETTE_SETS = 0xCC8000;
const DISPLAY_MODES = 0xC80100;

/** 128 BGR555 colours (BG palettes 0-7). */
export function loadBgPalettes(rom: Rom, set: number): Uint16Array {
    const cg = new Uint16Array(128);
    let src = PALETTE_SETS + (set & 0x7F) * 210;
    for (let pal = 1; pal < 8; pal++) {
        for (let c = 1; c < 16; c++, src += 2) cg[pal * 16 + c] = u16(rom, src) & 0x7FFF;
    }
    return cg;
}

export interface DisplayMode {
    mode: number;
    bytes: number[];
    main: number;       // TM
    sub: number;        // TS
    math: number;       // CGADSUB
    backdrop: number;   // BGR555 colour 0
}

export function readDisplayMode(rom: Rom, mode: number): DisplayMode {
    const bytes: number[] = [];
    for (let i = 0; i < 9; i++) bytes.push(u8(rom, DISPLAY_MODES + mode * 9 + i));
    return { mode, bytes, main: bytes[1], sub: bytes[2], math: bytes[3], backdrop: (bytes[7] | bytes[8] << 8) & 0x7FFF };
}
