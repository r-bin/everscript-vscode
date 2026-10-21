// Ownership: drawing a Terranigma room (room.ts) as the PPU would show it with the camera over every part
// of the map: each layer from its metatiles and its BG's characters, BG priority, the main and sub screens
// and colour math as the loader set them ($212C/$212D, $2130/$2131, $2132). A layer smaller than the map is
// one the game scrolls on its own: on the main screen it is a background and repeats; on the sub screen only
// it is a screen effect mixed in by colour math (light, haze) and is left out — repeated over the map it would
// light up places the game never does. A one-layer picture shows the layer as it is. Sprites, BG3 (text)
// and windows are not drawn. Pure.
import { tile4bpp } from '../../../platform/snes/tiles';
import type { TerraLayer, TerraRoom } from './room';

export interface Picture { width: number; height: number; rgba: Uint8Array }

/** The size of a room's picture in 16 px cells: the largest layer (0 × 0 without layers). */
export function roomSize(room: TerraRoom): { w: number; h: number } {
    return {
        w: Math.max(0, ...room.layers.map(l => l.w)),
        h: Math.max(0, ...room.layers.map(l => l.h)),
    };
}

/** The BG a layer is shown on: its own, else BG2 for layer 0 and BG1 for layer 1 (the usual layout). */
export function layerBg(l: TerraLayer): number { return l.bg || (l.index === 0 ? 2 : 1); }

/** One layer drawn over `w × h` pixels: BGR555 colour per pixel (-1 transparent) and its priority bit. */
function drawLayer(room: TerraRoom, l: TerraLayer, w: number, h: number) {
    const color = new Int32Array(w * h).fill(-1), prio = new Uint8Array(w * h);
    const base = (room.ppu.bgs[layerBg(l) - 1]?.chars ?? 0) * 2;
    const chars = new Map<number, Uint8Array>();
    const charAt = (n: number) => {
        let c = chars.get(n);
        if (!c) { c = tile4bpp(room.vram, (base + n * 32) & 0xFFFF); chars.set(n, c); }
        return c;
    };
    for (let cy = 0; cy < h >> 4; cy++) for (let cx = 0; cx < w >> 4; cx++) {
        const word = l.cells[(cy % l.h) * l.w + (cx % l.w)];
        const mt = word & 0x1FF;
        for (let q = 0; q < 4; q++) {
            const tw = l.metatiles[mt * 4 + q];
            const px = charAt(tw & 0x3FF), pal = ((tw >> 10) & 7) * 16, pr = (tw >> 13) & 1;
            const hf = tw & 0x4000, vf = tw & 0x8000;
            const ox = cx * 16 + (q & 1) * 8, oy = cy * 16 + (q >> 1) * 8;
            for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
                const c = px[(vf ? 7 - y : y) * 8 + (hf ? 7 - x : x)];
                if (!c) continue;
                const o = (oy + y) * w + ox + x;
                color[o] = room.palette[pal + c];
                prio[o] = pr;
            }
        }
    }
    return { bg: layerBg(l), color, prio };
}

const c8 = (c5: number) => (c5 << 3) | (c5 >> 2);

/**
 * The room's picture. `layers` picks which layers to draw (by index; default all). Colour math is
 * applied when both layers it mixes are drawn.
 */
export function renderRoom(room: TerraRoom, opts: { layers?: number[] } = {}): Picture {
    const { w: cw, h: ch } = roomSize(room);
    const width = cw * 16, height = ch * 16;
    const rgba = new Uint8Array(width * height * 4);
    const { main, sub, cgwsel, cgadsub, fixed } = room.ppu;
    const single = !!opts.layers && opts.layers.length === 1;
    const isMain = (l: TerraLayer) => single || !main || ((main >> (layerBg(l) - 1)) & 1) === 1;
    const effect = (l: TerraLayer) => !isMain(l) && (l.w < cw || l.h < ch);
    const shown = room.layers.filter(l => (!opts.layers || opts.layers.includes(l.index)) && !effect(l));
    // Front to back as on the PPU (modes 0/1): high-priority tiles of BG1 then BG2, then the low ones.
    const drawn = shown.map(l => ({ ...drawLayer(room, l, width, height), main: isMain(l) })).sort((a, b) => a.bg - b.bg);
    const onMain = drawn.filter(d => d.main);
    const onSub = drawn.filter(d => (sub >> (d.bg - 1)) & 1);
    const mathAllowed = !single && ((cgwsel >> 4) & 3) !== 3;
    const fixedColor = fixed[0] | (fixed[1] << 5) | (fixed[2] << 10);
    const top = (list: typeof drawn, o: number): [number, number] => {
        for (const p of [1, 0]) for (const d of list) if (d.color[o] >= 0 && d.prio[o] === p) return [d.color[o], d.bg];
        return [-1, 0];
    };
    for (let o = 0; o < width * height; o++) {
        let [c, src] = top(onMain, o);
        if (c < 0) { c = room.palette[0]; src = 6; }
        if (mathAllowed && (cgadsub >> (src === 6 ? 5 : src - 1)) & 1) {
            // The sub screen's backdrop is the fixed colour, and halving skips it.
            let s = cgwsel & 2 ? top(onSub, o)[0] : fixedColor;
            const half = (cgadsub & 0x40) !== 0 && !(cgwsel & 2 && s < 0);
            if (s < 0) s = fixedColor;
            const mix = (sh: number) => {
                const a = (c >> sh) & 31, b = (s >> sh) & 31;
                const v = (cgadsub & 0x80 ? Math.max(0, a - b) : a + b) >> (half ? 1 : 0);
                return Math.min(31, v);
            };
            c = mix(0) | (mix(5) << 5) | (mix(10) << 10);
        }
        rgba[o * 4] = c8(c & 31); rgba[o * 4 + 1] = c8((c >> 5) & 31); rgba[o * 4 + 2] = c8((c >> 10) & 31); rgba[o * 4 + 3] = 255;
    }
    return { width, height, rgba };
}

/** Metatiles per row of a sheet. */
const SHEET_COLUMNS = 16;

/** A layer's 512 metatiles as a 256 × 512 sheet, 16 per row; colour 0 transparent. */
export function renderMetatileSheet(room: TerraRoom, layerIndex: number): Picture {
    const l = room.layers.find(x => x.index === layerIndex);
    const width = SHEET_COLUMNS * 16, height = (512 / SHEET_COLUMNS) * 16;
    const rgba = new Uint8Array(width * height * 4);
    if (!l) return { width, height, rgba };
    const cells = new Uint16Array(512);
    for (let i = 0; i < 512; i++) cells[i] = i;
    const d = drawLayer(room, { ...l, w: SHEET_COLUMNS, h: 512 / SHEET_COLUMNS, cells }, width, height);
    for (let o = 0; o < width * height; o++) {
        const c = d.color[o];
        if (c < 0) continue;
        rgba[o * 4] = c8(c & 31); rgba[o * 4 + 1] = c8((c >> 5) & 31); rgba[o * 4 + 2] = c8((c >> 10) & 31); rgba[o * 4 + 3] = 255;
    }
    return { width, height, rgba };
}

/** A BGR555 colour as [r, g, b] 0-255. */
export function rgbOf(c: number): [number, number, number] { return [c8(c & 31), c8((c >> 5) & 31), c8((c >> 10) & 31)]; }
