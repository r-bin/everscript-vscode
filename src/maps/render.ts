// Ownership: turn a decoded room into RGBA pixels — VRAM tilemap layers and
// SNES Mode 1 compositing. Pure: no filesystem, no VS Code API, no canvas.
//
// Ported from everscript/tools/render_map.py (RoomRenderer).
// See docs/map-format/map_rendering_pipeline.md.

import { RoomData } from './room';
import { buildRoomCgramPalettes, Rgba } from './palette';
import { decompressTile16x16, decodeTilePixels } from './chr';

/** An RGBA pixel buffer with its dimensions. */
export interface PixelBuffer {
    width: number;
    height: number;
    /** `width * height * 4` bytes, RGBA. */
    data: Uint8Array;
}

export interface RenderOptions {
    /** Backdrop colour for pixels no enabled layer covers. Defaults to opaque black. */
    backdrop?: Rgba;
    /**
     * Keep only the pixels that are drawn **in front of sprites**, leaving the
     * rest transparent. See `renderRoomForeground`.
     */
    foregroundOnly?: boolean;
}

const DEFAULT_BACKDROP: Rgba = [0, 0, 0, 255];
const TRANSPARENT: Rgba = [0, 0, 0, 0];

/**
 * SNES tilemap word layout:
 *   bits 0..9   character index
 *   bits 10..12 palette
 *   bit 13      priority
 *   bit 14      horizontal flip
 *   bit 15      vertical flip
 */
const CHAR_MASK = 0x03ff;
const PRIORITY = 0x2000;
const HFLIP = 0x4000;
const VFLIP = 0x8000;

/**
 * Map a SNES character index to an index into the room's Block 1 tile palette.
 * Characters are laid out 0x20 per row, two per 16x16 metatile.
 */
function charIndexToPaletteSlot(charIdx: number): number {
    return Math.floor(charIdx / 0x20) * 8 + Math.floor((charIdx % 0x20) / 2);
}

/** Caches decompressed graphics and decoded/flipped pixel arrays for one room. */
class TileCache {
    private readonly tiles = new Map<number, Uint8Array>();
    private readonly pixels = new Map<number, Uint8Array>();

    constructor(private readonly rom: Uint8Array) {}

    /** 256 palette indices for a metatile, with flips applied. */
    get(tileId: number, hflip: boolean, vflip: boolean): Uint8Array {
        const key = (tileId << 2) | (hflip ? 1 : 0) | (vflip ? 2 : 0);
        let px = this.pixels.get(key);
        if (px) return px;

        let raw = this.tiles.get(tileId);
        if (!raw) {
            try {
                raw = decompressTile16x16(this.rom, tileId);
            } catch {
                raw = new Uint8Array(128); // unreadable graphic renders as transparent
            }
            this.tiles.set(tileId, raw);
        }
        px = decodeTilePixels(raw, hflip, vflip);
        this.pixels.set(key, px);
        return px;
    }
}

/** The tile IDs a room can draw: Block 1's palette plus Section 2's animated tiles. */
function paletteTileIds(room: RoomData): number[] {
    return room.tilePalette.concat(room.animatedTiles);
}

/** Render one VRAM tilemap layer to RGBA. Uncovered pixels stay fully transparent. */
export function renderVramLayer(rom: Uint8Array, room: RoomData, vramWords: number[][]): PixelBuffer {
    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;
    const width = wTiles * 16;
    const height = hTiles * 16;
    const data = new Uint8Array(width * height * 4);

    const palettes = buildRoomCgramPalettes(rom, room.tileFamilies);
    const tileIds = paletteTileIds(room);
    const cache = new TileCache(rom);

    for (let r = 0; r < hTiles; r++) {
        for (let c = 0; c < wTiles; c++) {
            const w = vramWords[r][c];
            const slot = charIndexToPaletteSlot(w & CHAR_MASK);
            const tileId = slot >= 0 && slot < tileIds.length ? tileIds[slot] : 0;
            const pixels = cache.get(tileId, (w & HFLIP) !== 0, (w & VFLIP) !== 0);
            const palette = palettes[(w >> 10) & 0x07];

            const baseY = r * 16;
            const baseX = c * 16;
            for (let py = 0; py < 16; py++) {
                let off = ((baseY + py) * width + baseX) * 4;
                const rowBase = py * 16;
                for (let px = 0; px < 16; px++, off += 4) {
                    const color = palette[pixels[rowBase + px]];
                    if (color[3] === 0) continue; // colour 0 is transparent
                    data[off] = color[0];
                    data[off + 1] = color[1];
                    data[off + 2] = color[2];
                    data[off + 3] = color[3];
                }
            }
        }
    }

    return { width, height, data };
}

/**
 * Composite BG1 (layer 2 / terrain) and BG2 (layer 1 / canopy) under SNES Mode 1
 * rules: main-screen enables from TM, per-tile priority bits, subscreen
 * selection from TS, and CGADSUB colour math (add / half-add / subtract).
 *
 * Priority order on the main screen: BG1 P1 > BG2 P1 > BG1 P0 > BG2 P0.
 */
export function compositeLayers(room: RoomData, l1: PixelBuffer, l2: PixelBuffer, opts: RenderOptions = {}): PixelBuffer {
    const { widthTiles: wTiles, heightTiles: hTiles, displayTm, subscreenTs, colorMath } = room.header;
    const width = l1.width;
    const height = l1.height;
    const out = new Uint8Array(width * height * 4);
    const backdrop = opts.foregroundOnly ? TRANSPARENT : (opts.backdrop || DEFAULT_BACKDROP);
    const foregroundOnly = opts.foregroundOnly === true;

    const bg1Main = (displayTm & 0x01) !== 0;
    const bg2Main = (displayTm & 0x02) !== 0;
    const bg1Sub = (subscreenTs & 0x01) !== 0;
    const bg2Sub = (subscreenTs & 0x02) !== 0;
    const subMath = (colorMath & 0x80) !== 0;
    const halfMath = (colorMath & 0x40) !== 0;
    const bg1Math = (colorMath & 0x01) !== 0;
    const bg2Math = (colorMath & 0x02) !== 0;

    const a = l1.data;
    const b = l2.data;

    for (let ty = 0; ty < hTiles; ty++) {
        for (let tx = 0; tx < wTiles; tx++) {
            const p1 = (room.layer1VramWords[ty][tx] & PRIORITY) !== 0;
            const p2 = (room.layer2VramWords[ty][tx] & PRIORITY) !== 0;

            for (let py = 0; py < 16; py++) {
                const y = ty * 16 + py;
                let i = (y * width + tx * 16) * 4;
                for (let px = 0; px < 16; px++, i += 4) {
                    const a1 = a[i + 3];
                    const a2 = b[i + 3];

                    // Main screen selection.
                    let mainLayer = 0;
                    let mr = 0;
                    let mg = 0;
                    let mb = 0;
                    if (bg1Main && p1 && a1 > 0) { mainLayer = 1; mr = a[i]; mg = a[i + 1]; mb = a[i + 2]; }
                    else if (bg2Main && p2 && a2 > 0) { mainLayer = 2; mr = b[i]; mg = b[i + 1]; mb = b[i + 2]; }
                    else if (bg1Main && !p1 && a1 > 0) { mainLayer = 1; mr = a[i]; mg = a[i + 1]; mb = a[i + 2]; }
                    else if (bg2Main && !p2 && a2 > 0) { mainLayer = 2; mr = b[i]; mg = b[i + 1]; mb = b[i + 2]; }

                    if (mainLayer === 0) {
                        out[i] = backdrop[0];
                        out[i + 1] = backdrop[1];
                        out[i + 2] = backdrop[2];
                        out[i + 3] = backdrop[3];
                        continue;
                    }

                    // Foreground pass: only the priority half of the layer that
                    // won, which is the half an ordinary sprite goes behind.
                    if (foregroundOnly && !((mainLayer === 1 && p1) || (mainLayer === 2 && p2))) {
                        out[i + 3] = 0;
                        continue;
                    }

                    // Subscreen selection, excluding whichever layer won the main screen.
                    let hasSub = false;
                    let sr = 0;
                    let sg = 0;
                    let sb = 0;
                    if (bg1Sub && p1 && a1 > 0 && mainLayer !== 1) { hasSub = true; sr = a[i]; sg = a[i + 1]; sb = a[i + 2]; }
                    else if (bg2Sub && p2 && a2 > 0 && mainLayer !== 2) { hasSub = true; sr = b[i]; sg = b[i + 1]; sb = b[i + 2]; }
                    else if (bg1Sub && !p1 && a1 > 0 && mainLayer !== 1) { hasSub = true; sr = a[i]; sg = a[i + 1]; sb = a[i + 2]; }
                    else if (bg2Sub && !p2 && a2 > 0 && mainLayer !== 2) { hasSub = true; sr = b[i]; sg = b[i + 1]; sb = b[i + 2]; }

                    const mathEnabled = (mainLayer === 1 && bg1Math) || (mainLayer === 2 && bg2Math);

                    if (mathEnabled && hasSub) {
                        if (subMath) {
                            out[i] = Math.max(0, mr - sr);
                            out[i + 1] = Math.max(0, mg - sg);
                            out[i + 2] = Math.max(0, mb - sb);
                        } else if (halfMath) {
                            out[i] = (mr + sr) >> 1;
                            out[i + 1] = (mg + sg) >> 1;
                            out[i + 2] = (mb + sb) >> 1;
                        } else {
                            out[i] = Math.min(255, mr + sr);
                            out[i + 1] = Math.min(255, mg + sg);
                            out[i + 2] = Math.min(255, mb + sb);
                        }
                    } else {
                        out[i] = mr;
                        out[i + 1] = mg;
                        out[i + 2] = mb;
                    }
                    out[i + 3] = 255;
                }
            }
        }
    }

    return { width, height, data: out };
}

/** Render a room to a composited RGBA image, the way the SNES would display it. */
export function renderRoomComposite(rom: Uint8Array, room: RoomData, opts: RenderOptions = {}): PixelBuffer {
    const l1 = renderVramLayer(rom, room, room.layer1VramWords);
    const l2 = renderVramLayer(rom, room, room.layer2VramWords);
    return compositeLayers(room, l1, l2, opts);
}

/**
 * The part of a room that is drawn **over** the characters standing in it.
 *
 * In Mode 1 the layer order is `OBJ.3 > BG1.1 > BG2.1 > OBJ.2 > BG1.0 >
 * BG2.0`, and `$8FC773` gives an entity priority 3 or 2 from the tile it is
 * standing on — 3 when that tile's collision word has bit 12, otherwise 2.
 * So a priority-2 character goes behind exactly the pixels this renders: the
 * priority half of whichever layer won.
 *
 * Everything else comes out transparent, so the result can be laid straight
 * over the composite and its characters.
 */
export function renderRoomForeground(rom: Uint8Array, room: RoomData): PixelBuffer {
    return renderRoomComposite(rom, room, { foregroundOnly: true });
}
