// Ownership: SNES palette extraction and CGRAM sub-palette construction.
// Pure. Ported from everscript/tools/render_map.py ($90D020 / $9CC322).
// See docs/map-format/map_palette_extraction.md.

/** An 8-bit RGBA colour. Index 0 of every sub-palette is transparent. */
export type Rgba = readonly [number, number, number, number];

/** ROM file offset of the tile-family palette table (SNES $9CC322). */
const PALETTE_TABLE = 0x1cc322;

/** Bytes per tile-family palette: 16 colours x 2 bytes. */
const PALETTE_STRIDE = 32;

/** Number of background sub-palettes in CGRAM. */
const CGRAM_SUBPALETTES = 8;

function emptyPalette(): Rgba[] {
    const out: Rgba[] = [];
    for (let i = 0; i < 16; i++) out.push([0, 0, 0, i === 0 ? 0 : 255]);
    return out;
}

/**
 * Extract the 16 colours of one tile family.
 *
 * Colour 0 is transparent; 1..15 are opaque. SNES stores BGR555, expanded to
 * 8 bits per channel with `(c << 3) | (c >> 2)`.
 */
export function extractTileFamilyPalette(rom: Uint8Array, familyId: number): Rgba[] {
    const base = PALETTE_TABLE + familyId * PALETTE_STRIDE;
    const colors: Rgba[] = [];

    for (let i = 0; i < 16; i++) {
        const c16 = rom[base + i * 2] | (rom[base + i * 2 + 1] << 8);
        const r5 = c16 & 0x1f;
        const g5 = (c16 >> 5) & 0x1f;
        const b5 = (c16 >> 10) & 0x1f;
        colors.push([
            (r5 << 3) | (r5 >> 2),
            (g5 << 3) | (g5 >> 2),
            (b5 << 3) | (b5 >> 2),
            i === 0 ? 0 : 255,
        ]);
    }
    return colors;
}

/**
 * Build a room's 8 CGRAM background sub-palettes.
 *
 * Palette 0 is the system/HUD default; 1..7 map 1:1 onto the room's tile
 * families (CGRAM colour 16 == palette 1).
 */
export function buildRoomCgramPalettes(rom: Uint8Array, tileFamilies: number[]): Rgba[][] {
    const palettes: Rgba[][] = [emptyPalette()];
    for (let idx = 0; idx < CGRAM_SUBPALETTES - 1; idx++) {
        palettes.push(idx < tileFamilies.length ? extractTileFamilyPalette(rom, tileFamilies[idx]) : emptyPalette());
    }
    return palettes;
}
