// Ownership: one layer's 192 metatiles as a picture sheet, for the map editor's picker and for
// redrawing cells a user changed. Plain pixels: each character in its tilemap word's palette,
// colour 0 transparent. No BG priority and no colour math: those need a whole screen
// (render.ts); a changed cell is drawn from this sheet over the real picture.

import { ManaMap } from './map';
import { ManaImage, drawChar, rgb, expand } from './render';
import { METATILES_PER_HALF } from './metatiles';

export const SHEET_COLUMNS = 16;

export function renderMetatileSheet(map: ManaMap, layer: 'A' | 'B'): ManaImage {
    const table = layer === 'A' ? map.tableA : map.tableB;
    const rows = METATILES_PER_HALF / SHEET_COLUMNS;
    const width = SHEET_COLUMNS * 16, height = rows * 16;
    const color = new Uint8Array(width * height), prio = new Uint8Array(width * height);
    for (let n = 0; n < METATILES_PER_HALF; n++) {
        const cx = (n % SHEET_COLUMNS) * 16, cy = Math.floor(n / SHEET_COLUMNS) * 16;
        for (let q = 0; q < 4; q++) drawChar(map.vram, table[n * 4 + q], cx + (q & 1) * 8, cy + (q >> 1) * 8, width, color, prio);
    }
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        if (!color[i]) continue;
        const c = rgb(map.cgram[color[i]]);
        rgba[i * 4] = expand(c[0]);
        rgba[i * 4 + 1] = expand(c[1]);
        rgba[i * 4 + 2] = expand(c[2]);
        rgba[i * 4 + 3] = 255;
    }
    return { width, height, rgba };
}
