// Ownership: Secret of Mana Tileset16, Palette, and Collision decoders.
//
// Reference: docs/map-format/secret-of-mana-comparison-and-porting.md §1.2 & §1.5.

export interface Subtile {
    tileNum: number;  // 10-bit 8x8 tile index (0..1023)
    pal: number;      // Palette index (0..7)
    vflip: boolean;
    hflip: boolean;
    altbg: boolean;
}

export type Metatile16 = [Subtile, Subtile, Subtile, Subtile];

class BitReader {
    private buf: Uint8Array;
    private byteNum: number = 0;
    private bitNum: number = 0;

    constructor(buf: Uint8Array) {
        this.buf = buf;
    }

    extractBits(numBits: number): number {
        let result = 0;
        for (let i = 0; i < numBits; i++) {
            result <<= 1;
            const mask = 1 << (7 - this.bitNum);
            if (this.byteNum < this.buf.length && (this.buf[this.byteNum] & mask) > 0) {
                result |= 1;
            }
            this.bitNum++;
            if (this.bitNum === 8) {
                this.byteNum++;
                this.bitNum = 0;
            }
        }
        return result;
    }
}

/**
 * Decode 384 16x16 metatiles from a compressed Tileset16 bitstream.
 */
export function decodeTileset16(buf: Uint8Array): Metatile16[] {
    const reader = new BitReader(buf);
    let tileNum = 0;
    let vflip = false;
    let hflip = false;
    let altbg = true;
    let pal = 4;
    const tiles: Metatile16[] = [];

    for (let i = 0; i < 384; i++) {
        const subTiles: Subtile[] = [];
        for (let j = 0; j < 4; j++) {
            const control1 = reader.extractBits(2);
            switch (control1) {
                case 0:
                    subTiles.push({ vflip, hflip, altbg, pal, tileNum });
                    break;
                case 1:
                    if ((tileNum & 0xFF) === 0xFF) tileNum -= 0xFF;
                    else tileNum++;
                    subTiles.push({ vflip, hflip, altbg, pal, tileNum });
                    break;
                case 2:
                    if ((tileNum & 0xFF) === 0) tileNum += 0xFF;
                    else tileNum--;
                    subTiles.push({ vflip, hflip, altbg, pal, tileNum });
                    break;
                case 3: {
                    const nextBit = reader.extractBits(1);
                    if (nextBit === 1) {
                        const fourthBit = reader.extractBits(1);
                        if (fourthBit === 1) {
                            vflip = reader.extractBits(1) > 0;
                            hflip = reader.extractBits(1) > 0;
                            altbg = reader.extractBits(1) > 0;
                            pal = reader.extractBits(3);
                            tileNum = reader.extractBits(10);
                            subTiles.push({ vflip, hflip, altbg, pal, tileNum });
                        } else {
                            const flagControlBit = reader.extractBits(1);
                            if (flagControlBit === 1) {
                                const flags = reader.extractBits(3);
                                vflip = (flags & 0x04) > 0;
                                hflip = (flags & 0x02) > 0;
                                altbg = (flags & 0x01) > 0;
                            } else {
                                pal = reader.extractBits(3);
                            }
                            let sixBitSignedAdd = reader.extractBits(6);
                            if (sixBitSignedAdd & 0x20) sixBitSignedAdd |= ~0x3F;
                            tileNum = (tileNum + sixBitSignedAdd) & 0x3FF;
                            subTiles.push({ vflip, hflip, altbg, pal, tileNum });
                        }
                    } else {
                        let sevenBitSignedAdd = reader.extractBits(7);
                        if (sevenBitSignedAdd & 0x40) sevenBitSignedAdd |= ~0x7F;
                        tileNum = (tileNum + sevenBitSignedAdd) & 0x3FF;
                        subTiles.push({ vflip, hflip, altbg, pal, tileNum });
                    }
                    break;
                }
            }
        }
        tiles.push([subTiles[0], subTiles[1], subTiles[2], subTiles[3]]);
    }
    return tiles;
}

/**
 * Extract palette set (7 palettes of 16 RGBA colors) from Bank $0C (0xC8000).
 */
export function extractPaletteSet(rom: Uint8Array, palSet: number): Uint8Array[] {
    const palOffset = 0xC8000 + (palSet & 0x7F) * 210;
    const palettes: Uint8Array[] = [];

    for (let p = 0; p < 7; p++) {
        // 16 colors * 4 bytes RGBA = 64 bytes
        const rgba = new Uint8Array(64);
        // Color 0 is transparent
        rgba[0] = 0; rgba[1] = 0; rgba[2] = 0; rgba[3] = 0;

        for (let c = 0; c < 15; c++) {
            const byteIdx = palOffset + p * 30 + c * 2;
            if (byteIdx + 1 < rom.length) {
                const raw = rom[byteIdx] | (rom[byteIdx + 1] << 8);
                const r = (raw & 0x1F) << 3;
                const g = ((raw >> 5) & 0x1F) << 3;
                const b = ((raw >> 10) & 0x1F) << 3;
                const dest = (c + 1) * 4;
                rgba[dest] = r;
                rgba[dest + 1] = g;
                rgba[dest + 2] = b;
                rgba[dest + 3] = 255;
            }
        }
        palettes.push(rgba);
    }
    return palettes;
}

/**
 * Read the 1-byte collision table for a 16x16 tileset (384 bytes, one per metatile).
 */
export function readTilesetCollision(rom: Uint8Array, tileset16: number): Uint8Array {
    const offset = 0xB0400 + (tileset16 & 0x3F) * 384;
    if (offset + 384 <= rom.length) {
        return rom.slice(offset, offset + 384);
    }
    return new Uint8Array(384);
}

/**
 * Read the 256 4-byte collision structs from Bank $0B ($B0000).
 */
export function readCollisionStructs(rom: Uint8Array): Uint8Array {
    if (0xB0000 + 1024 <= rom.length) {
        return rom.slice(0xB0000, 0xB0000 + 1024);
    }
    return new Uint8Array(1024);
}
