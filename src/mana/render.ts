// Ownership: drawing a decoded map the way the SNES PPU shows it (Mode 1, BG1 + BG2).
//
// Generic SNES rules only: 16x16 BG tiles made of four 8x8 4bpp characters
// from char base 0; tilemap word = v-flip 15, h-flip 14, priority 13,
// palette 10-12, char 0-9. Mode 1 order front to back: BG1 priority 1,
// BG2 priority 1, BG1 priority 0, BG2 priority 0, backdrop (colour 0).
// Colour math as CGWSEL $02 sets it: the sub screen is added (or subtracted,
// CGADSUB bit 7, halved with bit 6) to main-screen pixels of the layers CGADSUB
// enables; where the sub screen is empty the fixed colour (0) is used, unhalved.
// The game puts layer A on BG1 and layer B on BG2 (BG1SC $51, BG2SC $39 seen
// at the Potos waterfall); BG3 (text, weather) and sprites are not drawn.

import { ManaMap } from './map';

export interface ManaImage { width: number; height: number; rgba: Uint8Array }

interface LayerPixels { color: Uint8Array; prio: Uint8Array }

export function renderMap(map: ManaMap): ManaImage {
    const width = map.w * 16, height = map.h * 16;
    const a = drawLayer(map, 'A', width, height);
    const b = drawLayer(map, 'B', width, height);
    const { main, sub, math } = map.display;
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const m = pick(i, main, a, b), s = pick(i, sub, a, b);
        let c = rgb(map.cgram[m.color]);
        if (math & (m.layer === 1 ? 0x01 : m.layer === 2 ? 0x02 : 0x20)) {
            const half = (math & 0x40) && s.layer !== 0;
            const add = s.layer !== 0 ? rgb(map.cgram[s.color]) : [0, 0, 0];
            c = c.map((v, k) => {
                let r = math & 0x80 ? v - add[k] : v + add[k];
                if (half) r >>= 1;
                return Math.max(0, Math.min(31, r));
            });
        }
        rgba[i * 4] = expand(c[0]);
        rgba[i * 4 + 1] = expand(c[1]);
        rgba[i * 4 + 2] = expand(c[2]);
        rgba[i * 4 + 3] = 255;
    }
    return { width, height, rgba };
}

/** Topmost opaque pixel among the enabled BG layers (layer 0 = backdrop). */
function pick(i: number, enabled: number, a: LayerPixels, b: LayerPixels): { color: number; layer: number } {
    const en1 = enabled & 1, en2 = enabled & 2;
    if (en1 && a.color[i] && a.prio[i]) return { color: a.color[i], layer: 1 };
    if (en2 && b.color[i] && b.prio[i]) return { color: b.color[i], layer: 2 };
    if (en1 && a.color[i]) return { color: a.color[i], layer: 1 };
    if (en2 && b.color[i]) return { color: b.color[i], layer: 2 };
    return { color: 0, layer: 0 };
}

function drawLayer(map: ManaMap, which: 'A' | 'B', width: number, height: number): LayerPixels {
    const color = new Uint8Array(width * height), prio = new Uint8Array(width * height);
    const table = which === 'A' ? map.tableA : map.tableB;
    for (let cy = 0; cy < map.h; cy++) {
        for (let cx = 0; cx < map.w; cx++) {
            const n = map.cell(which, cx, cy);
            if (n < 0 || n >= 192) continue;
            for (let q = 0; q < 4; q++) {
                const word = table[n * 4 + q];
                drawChar(map.vram, word, cx * 16 + (q & 1) * 8, cy * 16 + (q >> 1) * 8, width, color, prio);
            }
        }
    }
    return { color, prio };
}

function drawChar(vram: Uint8Array, word: number, x0: number, y0: number, width: number,
    color: Uint8Array, prio: Uint8Array): void {
    const base = (word & 0x3FF) * 32, pal = ((word >> 10) & 7) * 16, p = (word >> 13) & 1;
    const hf = word & 0x4000, vf = word & 0x8000;
    for (let y = 0; y < 8; y++) {
        const r = base + (vf ? 7 - y : y) * 2;
        const p0 = vram[r], p1 = vram[r + 1], p2 = vram[r + 16], p3 = vram[r + 17];
        for (let x = 0; x < 8; x++) {
            const bit = hf ? x : 7 - x;
            const c = ((p0 >> bit) & 1) | ((p1 >> bit) & 1) << 1 | ((p2 >> bit) & 1) << 2 | ((p3 >> bit) & 1) << 3;
            if (!c) continue;
            const i = (y0 + y) * width + x0 + x;
            color[i] = pal + c;
            prio[i] = p;
        }
    }
}

function rgb(c: number): number[] {
    return [c & 31, (c >> 5) & 31, (c >> 10) & 31];
}

function expand(v: number): number {
    return (v << 3) | (v >> 2);
}
