// Ownership: decoding character/object sprites out of the ROM. Pure.
//
// A port of SoETilesViewer's `spriteblock.h` and `spriteinfo.h`, which is the
// only implementation of this format anywhere. Verified by rendering: the
// walk finds 5128 sprites and they come out as recognisable characters.
//
// Three layers:
//
//   **Blocks** are the pixels. Two pools, each a table of 24-bit pointers:
//   16x16 blocks at $EC0000 with data based at $D90000, and 8x8 blocks at
//   $D80000 based at $D10000. Bit 23 of the pointer marks the data as
//   compressed.
//
//   **Chunks** place a block at a signed offset. Five bytes: flags, x, y and
//   a 16-bit block id. Bit 0 of `flags` picks the pool — set means 16x16.
//
//   **Sprite infos** are a chunk list: a count, a data offset, then the
//   chunks. They sit end to end from $CA0003 and are walked sequentially,
//   since nothing indexes them.
//
// The compression is a bit-per-word skip list: one status byte per eight
// output words, a set bit meaning "this word is zero, it is not stored".
//
// **What this cannot do yet:** get from a character to its sprite. The
// character table's `anim_stand` and friends point into an animation format
// nobody has decoded — see docs/sprite-rendering.md for the readings already
// ruled out. So sprites are addressable by index, not by enemy.

import { snesToRom, read24, readByte } from './rom';

/** Byte at a SNES address. */
const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));

/** Palette indices, row-major, `size` x `size`. */
export interface SpriteBlockPixels {
    size: number;
    pixels: Uint8Array;
}

interface Pool {
    /** Table of 24-bit data pointers. */
    pointers: number;
    /** Base the pointer is relative to. */
    data: number;
    size: number;
}

const LARGE: Pool = { pointers: 0xec0000, data: 0xd90000, size: 16 };
const SMALL: Pool = { pointers: 0xd80000, data: 0xd10000, size: 8 };

/** Where the sprite-info list starts. Not $CA0001 — upstream notes that too. */
export const SPRITE_LIST_START = 0xca0003;

/** A block's raw 4bpp planar bytes, decompressing if the pointer says so. */
function blockBytes(rom: Uint8Array, index: number, pool: Pool): Uint8Array {
    const raw = read24(rom, snesToRom(pool.pointers + index * 3));
    const compressed = (raw >>> 23) & 1;
    const addr = ((raw & ~(1 << 23)) >>> 0) + pool.data;
    const sub = pool.size / 8;
    const length = (8 * 8 * sub * sub) / 2;
    const out = new Uint8Array(length);

    if (!compressed) {
        for (let i = 0; i < length; i++) out[i] = at(rom, addr + i);
        return out;
    }
    // One status byte per eight output words; a set bit means the word is
    // zero and was not stored.
    let src = addr;
    let dst = 0;
    for (let group = 0; group < length / 16; group++) {
        let bits = at(rom, src++);
        for (let bit = 0; bit < 8; bit++, bits >>= 1) {
            if (bits & 1) { dst += 2; continue; }        // stored as zero
            out[dst++] = at(rom, src++);
            out[dst++] = at(rom, src++);
        }
    }
    return out;
}

/**
 * One sprite block as palette indices.
 *
 * A 16x16 block is four 8x8 SNES tiles in the order top-left, top-right,
 * bottom-left, bottom-right, each 32 bytes of 4bpp planar data.
 */
export function decodeSpriteBlock(rom: Uint8Array, index: number, large: boolean): SpriteBlockPixels {
    const pool = large ? LARGE : SMALL;
    const d = blockBytes(rom, index, pool);
    const sub = pool.size / 8;
    const pixels = new Uint8Array(pool.size * pool.size);
    let n = 0;
    for (let l = 0; l < sub; l++) {
        for (let row = 0; row < 8; row++) {
            for (let j = 0; j < sub; j++) {
                const base = (j + 2 * l) * 32 + row * 2;
                for (let bit = 7; bit >= 0; bit--) {
                    let p = 0;
                    if (d[base + 0] & (1 << bit)) p |= 1;
                    if (d[base + 1] & (1 << bit)) p |= 2;
                    if (d[base + 16] & (1 << bit)) p |= 4;
                    if (d[base + 17] & (1 << bit)) p |= 8;
                    pixels[n++] = p;
                }
            }
        }
    }
    return { size: pool.size, pixels };
}

export interface SpriteChunk {
    flags: number;
    /** Signed offsets from the sprite's origin. */
    x: number;
    y: number;
    block: number;
    /** Bit 0 of flags: a 16x16 block rather than an 8x8 one. */
    large: boolean;
    /** Bit 6: draw the block mirrored left-to-right. */
    flipX: boolean;
    /** Bit 7: mirrored top-to-bottom. */
    flipY: boolean;
}

/**
 * Flags that matter for drawing.
 *
 * Symmetrical sprites reuse one block for both halves and mirror it, so a
 * decoder that ignores bit 6 draws the mirrored half twice — Strongheart's
 * face comes out with one side duplicated. 31% of all chunks set it.
 *
 * Bit 4 is set on 88% of chunks and bit 1 on under 1%; neither affects the
 * pixels, so neither is decoded here.
 */
const CHUNK_LARGE = 0x01;
const CHUNK_FLIP_X = 0x40;
const CHUNK_FLIP_Y = 0x80;

export interface SpriteInfo {
    address: number;
    chunks: SpriteChunk[];
    /** Total bytes, so the next sprite can be found. */
    size: number;
}

const CHUNK_BYTES = 5;
const MAX_CHUNKS = 64;

/** Read the chunk list at `address`. */
export function readSpriteInfo(rom: Uint8Array, address: number): SpriteInfo {
    const count = at(rom, address);
    const dataOffset = at(rom, address + 1);
    const chunks: SpriteChunk[] = [];
    let cursor = address;
    for (let n = 0; n < count; n++) {
        const c = cursor + dataOffset;
        const flags = at(rom, c);
        chunks.push({
            flags,
            x: (at(rom, c + 1) << 24) >> 24,
            y: (at(rom, c + 2) << 24) >> 24,
            block: at(rom, c + 3) | (at(rom, c + 4) << 8),
            large: (flags & CHUNK_LARGE) !== 0,
            flipX: (flags & CHUNK_FLIP_X) !== 0,
            flipY: (flags & CHUNK_FLIP_Y) !== 0,
        });
        cursor += CHUNK_BYTES;
    }
    return { address, chunks, size: dataOffset + count * CHUNK_BYTES };
}

/**
 * Walk the sprite list from the start.
 *
 * Nothing indexes these, so they are read end to end. A zero-length entry or
 * one that runs up against the end of a bank means the list continues in the
 * next bank — upstream's rule, kept because it is what makes the walk reach
 * all 5128.
 */
export function walkSprites(rom: Uint8Array, limit = 20000): SpriteInfo[] {
    const out: SpriteInfo[] = [];
    let addr = SPRITE_LIST_START;
    for (let i = 0; i < limit; i++) {
        if (snesToRom(addr) >= rom.length - 7) break;
        let info = readSpriteInfo(rom, addr);
        if (info.chunks.length === 0 || (addr & 0xffff) > 0x7ffd) {
            addr = (addr & 0xff0000) + 0x10001;
            info = readSpriteInfo(rom, addr);
        }
        if (info.chunks.length > MAX_CHUNKS) break;
        out.push(info);
        addr += info.size;
    }
    return out;
}

export interface SpritePixels {
    width: number;
    height: number;
    /** Palette index per pixel; -1 where nothing was drawn. */
    pixels: Int16Array;
    /** Where the sprite's origin sits inside the buffer. */
    originX: number;
    originY: number;
}

/**
 * Compose a sprite's chunks into one buffer.
 *
 * Chunk offsets are signed and relative to an origin that is not at a
 * corner, so the extent is measured first rather than assuming a canvas
 * size — several sprites reach well above and left of their origin.
 */
export function composeSprite(rom: Uint8Array, info: SpriteInfo): SpritePixels {
    let minX = 0; let minY = 0; let maxX = 1; let maxY = 1;
    for (const c of info.chunks) {
        const s = c.large ? 16 : 8;
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.x + s > maxX) maxX = c.x + s;
        if (c.y + s > maxY) maxY = c.y + s;
    }
    const width = maxX - minX;
    const height = maxY - minY;
    const pixels = new Int16Array(width * height).fill(-1);
    for (const c of info.chunks) {
        const b = decodeSpriteBlock(rom, c.block, c.large);
        for (let y = 0; y < b.size; y++) {
            for (let x = 0; x < b.size; x++) {
                const sx = c.flipX ? b.size - 1 - x : x;
                const sy = c.flipY ? b.size - 1 - y : y;
                const v = b.pixels[sy * b.size + sx];
                if (!v) continue;                       // index 0 is transparent
                const px = c.x - minX + x;
                const py = c.y - minY + y;
                if (px < 0 || py < 0 || px >= width || py >= height) continue;
                pixels[py * width + px] = v;
            }
        }
    }
    return { width, height, pixels, originX: -minX, originY: -minY };
}
