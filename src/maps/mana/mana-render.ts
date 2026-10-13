// Ownership: Secret of Mana composite map raster renderer.
//
// Renders flattened composite maps into RGBA pixel buffers and PNG data URIs
// for the Rooms tab webview.
// Reference: docs/map-format/secret-of-mana-comparison-and-porting.md §1 & §3.

import { ManaRoomData } from './mana-room';
import { Subtile } from './mana-tileset';
import { encodePngDataUri } from '../png';
import { PixelBuffer } from '../render';

/**
 * Decode an 8x8 4bpp planar tile from ROM.
 */
function decode4bppTile(rom: Uint8Array, offset: number): Uint8Array {
    const pixels = new Uint8Array(64);
    if (offset + 32 > rom.length) return pixels;

    for (let y = 0; y < 8; y++) {
        const p0 = rom[offset + y * 2];
        const p1 = rom[offset + y * 2 + 1];
        const p2 = rom[offset + 16 + y * 2];
        const p3 = rom[offset + 16 + y * 2 + 1];
        for (let x = 0; x < 8; x++) {
            const bit = 7 - x;
            const c = ((p0 >> bit) & 1) | (((p1 >> bit) & 1) << 1) | (((p2 >> bit) & 1) << 2) | (((p3 >> bit) & 1) << 3);
            pixels[y * 8 + x] = c;
        }
    }
    return pixels;
}

/**
 * Resolve the ROM byte offset for an 8x8 tile number.
 */
function getTileRomOffset(rom: Uint8Array, tileNum: number, tileset8: number): number {
    // In Secret of Mana, Bank $1F ($1F0000) holds the primary 4bpp terrain tiles.
    // If tileNum exceeds 1024 or is in secondary banks:
    const baseOffset = 0x1F0000;
    const off = baseOffset + (tileNum & 0x7FF) * 32;
    if (off + 32 <= rom.length) return off;
    return 0x1F0000;
}

/**
 * Paint an 8x8 subtile onto the destination RGBA image buffer.
 */
function paintSubtile(
    dest: Uint8Array,
    imgWidth: number,
    imgHeight: number,
    destX: number,
    destY: number,
    subtile: Subtile,
    palette: Uint8Array,
    tilePx: Uint8Array
): void {
    for (let py = 0; py < 8; py++) {
        const srcY = subtile.vflip ? (7 - py) : py;
        const targetY = destY + py;
        if (targetY < 0 || targetY >= imgHeight) continue;

        for (let px = 0; px < 8; px++) {
            const srcX = subtile.hflip ? (7 - px) : px;
            const targetX = destX + px;
            if (targetX < 0 || targetX >= imgWidth) continue;

            const colorIdx = tilePx[srcY * 8 + srcX];
            // Color 0 is transparent in SNES Mode 1
            if (colorIdx === 0) continue;

            const pDest = (targetY * imgWidth + targetX) * 4;
            const palOffset = colorIdx * 4;
            dest[pDest] = palette[palOffset];
            dest[pDest + 1] = palette[palOffset + 1];
            dest[pDest + 2] = palette[palOffset + 2];
            dest[pDest + 3] = 255;
        }
    }
}

/**
 * Paint a 16x16 metatile onto the destination RGBA image buffer.
 */
function paintMetatile(
    dest: Uint8Array,
    imgWidth: number,
    imgHeight: number,
    cellX: number,
    cellY: number,
    metatile: [Subtile, Subtile, Subtile, Subtile],
    palettes: Uint8Array[],
    rom: Uint8Array,
    tileset8: number
): void {
    const posX = cellX * 16;
    const posY = cellY * 16;

    // Subtile positions: [0: TL, 1: TR, 2: BL, 3: BR]
    const subOffsets = [
        { dx: 0, dy: 0 },
        { dx: 8, dy: 0 },
        { dx: 0, dy: 8 },
        { dx: 8, dy: 8 },
    ];

    for (let i = 0; i < 4; i++) {
        const sub = metatile[i];
        if (!sub) continue;
        const pal = palettes[sub.pal % palettes.length] || palettes[0];
        const tileOffset = getTileRomOffset(rom, sub.tileNum, tileset8);
        const tilePx = decode4bppTile(rom, tileOffset);
        paintSubtile(dest, imgWidth, imgHeight, posX + subOffsets[i].dx, posY + subOffsets[i].dy, sub, pal, tilePx);
    }
}

/**
 * Render a complete Secret of Mana composite map to an RGBA PixelBuffer and PNG data URI.
 */
export function renderManaRoom(rom: Uint8Array, room: ManaRoomData): {
    buffer: PixelBuffer;
    imageUri: string;
    width: number;
    height: number;
} {
    const width = room.mapW * 16;
    const height = room.mapH * 16;
    const data = new Uint8Array(width * height * 4);

    // Initial background clear: dark tone
    for (let i = 0; i < width * height; i++) {
        data[i * 4] = 20;
        data[i * 4 + 1] = 24;
        data[i * 4 + 2] = 28;
        data[i * 4 + 3] = 255;
    }

    const t16 = room.tileset16;
    const pals = room.palettes;
    const t8 = room.header.tileset8;

    // Layer 2: Terrain
    if (t16.length > 0 && pals.length > 0) {
        for (let cy = 0; cy < room.mapH; cy++) {
            for (let cx = 0; cx < room.mapW; cx++) {
                const cellIdx = cy * room.mapW + cx;
                let tId = room.gridTerrain[cellIdx];
                if (room.header.layer2UsesForegroundTiles) {
                    tId = (tId + 192) & 0x1FF;
                }
                const meta = t16[tId % t16.length];
                if (meta) {
                    paintMetatile(data, width, height, cx, cy, meta, pals, rom, t8);
                }
            }
        }

        // Layer 1: Canopy / Foreground
        for (let cy = 0; cy < room.mapH; cy++) {
            for (let cx = 0; cx < room.mapW; cx++) {
                const cellIdx = cy * room.mapW + cx;
                let tId = room.gridCanopy[cellIdx];
                // 0 is transparent/empty canopy
                if (tId === 0) continue;
                if (room.header.layer1UsesForegroundTiles) {
                    tId = (tId + 192) & 0x1FF;
                }
                const meta = t16[tId % t16.length];
                if (meta) {
                    paintMetatile(data, width, height, cx, cy, meta, pals, rom, t8);
                }
            }
        }
    }

    const buffer: PixelBuffer = { width, height, data };
    const imageUri = encodePngDataUri(buffer);

    return { buffer, imageUri, width, height };
}
