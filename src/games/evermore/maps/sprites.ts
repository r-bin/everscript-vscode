// Ownership: sprites as the game draws them — a sprite record's chunks, a chunk's block pixels, a
// composed image — and every sprite the animation scripts name. Pure.
//
// Read from the game's own code (knowledge rom/809033.md, rom/809751.md):
//   record    $80:9033 reads [$26]: count, offset of the first chunk, and when count >= 3 a
//             bounding box (x:s8 y:s8 w:u8 h:u8) it culls by; then `count` chunks of 5 bytes
//   chunk     flags, x:s8, y:s8, block:u16. Flags bit 0: 16x16; bits 1-3 palette, 4-5 priority,
//             6/7 flip (the OAM attribute byte, through the mask in $07, $80:9433)
//   block     3 bytes at $EC:0000 + 3·id (16x16) or $D8:0000 + 3·id (8x8): a 16-bit address and a
//             bank byte, $D9 (16x16) / $D1 (8x8) + its low 7 bits; bit 7 = compressed ($80:9742,
//             $80:A4FC). Compressed data is groups of 16 bytes, each a mask byte whose bits
//             (lowest first) mark the group's zero words, then the other words.
//   16x16     the 128 bytes are four 8x8 tiles; the NMI ($80:82A1) puts bytes 0-63 at the tile
//             and 64-127 one OBJ row down: top-left, top-right, bottom-left, bottom-right
//   naming    animation opcodes 0x22-0x2B set the sprite to bank $A8 + opcode : word ($90:8418);
//             0x2C and the long forms carry a 24-bit address (animation-opcodes.ts)

import { busU8, busU16 } from '../../../platform/snes/hirom';
import { tile4bpp } from '../../../platform/snes/tiles';
import { animationGroups } from './animation-table';
import { disassembleScript, opcode, segmentsAt, spriteOperand, sprite2Operand, sprite24At } from './animation-opcodes';

/** Palette indices, row-major, `size` x `size`. */
export interface SpriteBlockPixels {
    size: number;
    pixels: Uint8Array;
}

const LARGE = { table: 0xec0000, bank: 0xd9, bytes: 128 };
const SMALL = { table: 0xd80000, bank: 0xd1, bytes: 32 };
const GROUP = 16;

/** A block's bytes, decompressed as $80:9742 / $80:A4FC do. */
function blockBytes(rom: Uint8Array, index: number, large: boolean): Uint8Array {
    const t = large ? LARGE : SMALL;
    const e = t.table + 3 * index;
    const hi = busU8(rom, e + 2);
    let p = (((t.bank + (hi & 0x7f)) << 16) | busU16(rom, e)) >>> 0;
    const out = new Uint8Array(t.bytes);
    if (!(hi & 0x80)) {
        for (let i = 0; i < t.bytes; i++) out[i] = busU8(rom, p + i);
        return out;
    }
    for (let g = 0; g < t.bytes; g += GROUP) {
        const mask = busU8(rom, p++);
        for (let w = 0; w < GROUP / 2; w++) {
            if (mask & (1 << w)) continue;
            out[g + 2 * w] = busU8(rom, p);
            out[g + 2 * w + 1] = busU8(rom, p + 1);
            p += 2;
        }
    }
    return out;
}

/** One sprite block as palette indices. */
export function decodeSpriteBlock(rom: Uint8Array, index: number, large: boolean): SpriteBlockPixels {
    const bytes = blockBytes(rom, index, large);
    if (!large) return { size: 8, pixels: tile4bpp(bytes) };
    const pixels = new Uint8Array(256);
    for (let t = 0; t < 4; t++) {
        const tile = tile4bpp(bytes, 32 * t);
        const x0 = (t & 1) * 8, y0 = (t >> 1) * 8;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) pixels[(y0 + r) * 16 + x0 + c] = tile[r * 8 + c];
    }
    return { size: 16, pixels };
}

export interface SpriteChunk {
    flags: number;
    /** Signed offsets from the sprite's origin. */
    x: number;
    y: number;
    block: number;
    /** Flags bit 0: a 16x16 block rather than an 8x8 one. */
    large: boolean;
    /** Bit 6: mirrored left to right. */
    flipX: boolean;
    /** Bit 7: mirrored top to bottom. */
    flipY: boolean;
    /** Bits 4-5: the OAM priority. */
    priority: number;
    /** Bits 1-3: which of the character's palettes. */
    palette: number;
}

export interface SpriteInfo {
    address: number;
    chunks: SpriteChunk[];
    /** Bytes the record spans: up to the end of its last chunk. */
    size: number;
}

const CHUNK = 5;
const s8 = (v: number): number => (v << 24) >> 24;

/** The sprite record at `address`, as $80:9033 reads it. */
export function readSpriteInfo(rom: Uint8Array, address: number): SpriteInfo {
    const count = busU8(rom, address);
    const first = busU8(rom, address + 1);
    const chunks: SpriteChunk[] = [];
    for (let i = 0; i < count; i++) {
        const c = address + first + CHUNK * i;
        const flags = busU8(rom, c);
        chunks.push({
            flags, x: s8(busU8(rom, c + 1)), y: s8(busU8(rom, c + 2)), block: busU16(rom, c + 3),
            large: (flags & 1) !== 0, flipX: (flags & 0x40) !== 0, flipY: (flags & 0x80) !== 0,
            priority: (flags >> 4) & 3, palette: (flags >> 1) & 7,
        });
    }
    return { address, chunks, size: count ? first + CHUNK * count : 2 };
}

/** Sprite addresses an animation script names, in the sprite banks: every sprite-setting command it can reach. */
export function scriptSprites(rom: Uint8Array, script: number): number[] {
    const found: number[] = [];
    for (const line of disassembleScript(rom, script)) {
        const o = opcode(line.bytes[0]);
        if (!o) continue;
        const p = line.address;
        if (o.kind === 'sprite') found.push(spriteOperand(rom, p));
        else if (o.kind === 'sprite2') found.push(sprite2Operand(rom, p));
        else if (o.kind === 'sprite_long') found.push(sprite24At(rom, p + 1));
        else if (o.kind === 'sprite_aim') for (let i = 0; i < 8; i++) found.push(sprite24At(rom, p + 1 + 3 * i));
        else if (o.kind === 'hud') for (let i = 0; i < (o.length - 1) / 3; i++) found.push(sprite24At(rom, p + 1 + 3 * i));
        else if (o.kind === 'segments') for (const s of segmentsAt(rom, p).groups) found.push(s.sprite);
    }
    return found.filter((a) => (a >>> 16) >= 0xca && (a >>> 16) <= 0xd3 && (a & 0xffff) !== 0);
}

/** The first sprite an animation names that draws something. */
export const SPRITE_LIST_START = 0xca0003;

const spritesCache = new WeakMap<Uint8Array, number[]>();

/** Every sprite address the animation scripts name, in address order. */
export function spriteAddresses(rom: Uint8Array): number[] {
    const cached = spritesCache.get(rom);
    if (cached) return cached;
    const found = new Set<number>();
    const seen = new Set<number>();
    for (const g of animationGroups(rom)) {
        for (const script of g.scripts) {
            if (!script || seen.has(script)) continue;
            seen.add(script);
            for (const a of scriptSprites(rom, script)) found.add(a);
        }
    }
    const out = [...found].sort((a, b) => a - b);
    spritesCache.set(rom, out);
    return out;
}

/**
 * Every sprite the animations name that draws something, in address order; `limit` keeps the first
 * ones. (A count of 0, such as $CA:0001, is the empty frame: $80:9033 returns at once.)
 */
export function walkSprites(rom: Uint8Array, limit = Infinity): SpriteInfo[] {
    const out: SpriteInfo[] = [];
    for (const a of spriteAddresses(rom)) {
        if (out.length >= limit) break;
        const s = readSpriteInfo(rom, a);
        if (s.chunks.length) out.push(s);
    }
    return out;
}

export interface SpritePixels {
    width: number;
    height: number;
    /** Palette index per pixel; -1 where nothing was drawn. */
    pixels: Int16Array;
    /** The chunk's palette bits per pixel. */
    palettes: Uint8Array;
    /** Where the sprite's origin sits inside the buffer. */
    originX: number;
    originY: number;
}

/**
 * The chunks drawn into one buffer. Offsets are signed, so the extent is measured first. The chunks
 * become OAM entries in list order, and the PPU shows a lower OAM index in front of a higher one
 * (priority deciding first), so the first chunk ends up on top.
 */
export function composeSprite(rom: Uint8Array, info: SpriteInfo): SpritePixels {
    const chunks = info.chunks;
    if (!chunks.length) return { width: 0, height: 0, pixels: new Int16Array(0), palettes: new Uint8Array(0), originX: 0, originY: 0 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of chunks) {
        const n = c.large ? 16 : 8;
        x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + n); y1 = Math.max(y1, c.y + n);
    }
    const width = x1 - x0, height = y1 - y0;
    const pixels = new Int16Array(width * height).fill(-1);
    const palettes = new Uint8Array(width * height);
    // Paint back to front: lowest priority first, and within one priority the last chunk first.
    const order = chunks.map((c, i) => ({ c, i })).sort((a, b) => a.c.priority - b.c.priority || b.i - a.i);
    for (const { c } of order) {
        const b = decodeSpriteBlock(rom, c.block, c.large);
        for (let r = 0; r < b.size; r++) {
            for (let q = 0; q < b.size; q++) {
                const v = b.pixels[(c.flipY ? b.size - 1 - r : r) * b.size + (c.flipX ? b.size - 1 - q : q)];
                if (!v) continue;
                const at = (c.y - y0 + r) * width + (c.x - x0 + q);
                pixels[at] = v;
                palettes[at] = c.palette;
            }
        }
    }
    return { width, height, pixels, palettes, originX: -x0, originY: -y0 };
}
