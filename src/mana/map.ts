// Ownership: one Secret of Mana map with everything needed to draw it, loaded in the
// order the game's loader $00:C481 uses (chars + palettes, metatiles, pieces).

import { Rom } from './rom';
import { readHeader, ManaHeader } from './header';
import { assembleLayers, FlagValues, LAYER_A, LAYER_B, ROW, Placement } from './placement';
import { decodeMetatileSet, metatileHalf } from './metatiles';
import { loadBgChars } from './chars';
import { loadBgPalettes, readDisplayMode, DisplayMode } from './palette';

export interface ManaMap {
    id: number;
    header: ManaHeader;
    /** Size in 16x16 cells (layer A's first piece). */
    w: number;
    h: number;
    sizeB: { w: number; h: number } | null;
    /** Bank $7F image: layer A cells at $0000, layer B at $4000, $80 per row. */
    mem: Uint8Array;
    tableA: Uint16Array;
    tableB: Uint16Array;
    vram: Uint8Array;
    cgram: Uint16Array;
    display: DisplayMode;
    placed: Placement[];
    skipped: Placement[];
    /** Metatile index of a cell; layer B repeats with its own size ($00:D11B wraps by $A0). */
    cell(layer: 'A' | 'B', x: number, y: number): number;
}

export function loadMap(rom: Rom, id: number, flags?: FlagValues): ManaMap | null {
    const header = readHeader(rom, id);
    const layers = assembleLayers(rom, id, flags);
    if (!layers.sizeA) return null;
    const set = decodeMetatileSet(rom, header.metatileSet);
    const { mem, sizeA, sizeB } = layers;
    const display = readDisplayMode(rom, header.display);
    const cgram = loadBgPalettes(rom, header.paletteSet);
    cgram[0] = display.backdrop;
    return {
        id,
        header,
        w: sizeA.w,
        h: sizeA.h,
        sizeB,
        mem,
        tableA: metatileHalf(set, header.halfA),
        tableB: metatileHalf(set, header.halfB),
        vram: loadBgChars(rom, header.charSet, header.animSlot),
        cgram,
        display,
        placed: layers.placed,
        skipped: layers.skipped,
        cell(layer, x, y) {
            if (layer === 'A') return mem[LAYER_A + y * ROW + x];
            if (!sizeB) return -1;
            return mem[LAYER_B + (y % sizeB.h) * ROW + (x % sizeB.w)];
        },
    };
}
