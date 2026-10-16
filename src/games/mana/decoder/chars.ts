// Ownership: the BG character data a map loads into VRAM, as $01:F5CE and $01:F413 do.
//
// $01:F413: $CC:E27E + set*2 and the next word bound (bank $CC) a list of
// 3-byte entries [word W, byte count-1], written one after another from VRAM
// word $0000. The top 3 bits of W pick the source format ($01:F456); each
// format has a base pointer in the four 24-bit words at $CC:E270:
//   W < $8000   2bpp, 16 bytes/char at base0 + W*16; planes 2/3 filled with
//               $FF when bit 14 / bit 13 is set, else $00
//   $8000-$BFFF 3bpp, 24 bytes/char at base1 + W*24; plane 3 = bit 13 ? $FF : $00
//   $C000-$DFFF 4bpp copied as is: base2 + (W&$1FFF)*32, count*32 bytes
//   $E000-$FFFF 4bpp copied as is: base3 + (W&$1FFF)*64, count*64 bytes
//               (the 16-bit ROR into $03/$04 keeps the low bits of the index)
// $01:F5CE first fills VRAM words $3600-$37FF (chars $360-$37F) with 8 blocks
// of 4 chars: slot = byte at $C8:0400 + header byte 0; block i comes from
// $DC:8000 + (byte at $C8:0441 + slot*2 + i & $3F) * $200.
// When header byte 0 has bit 7 set, $01:B0EC replaces that with animated
// tiles: slot = $C8:0400[byte0 & $3F], (next slot - slot)*2 records (2 if 0),
// record k streams 4 chars to $360 + (k&7)*4 from the same block address,
// stepping $80 bytes a frame through the $200-byte block (NMI DMA at $00:C319).
// The picture uses frame 0.

import { Rom, u8, u16, u24, offset } from './rom';

const FORMAT_BASES = 0xCCE270;
const LIST_POINTERS = 0xCCE27E;
const ANIM_SLOTS = 0xC80400;
const ANIM_BLOCKS = 0xC80441;

/** 64 KB VRAM image holding the map's BG characters (4bpp, 32 bytes each). */
export function loadBgChars(rom: Rom, charSet: number, animSlot: number): Uint8Array {
    const vram = new Uint8Array(0x10000);
    const slot = u8(rom, ANIM_SLOTS + animSlot);
    for (let i = 0; i < 8; i++) {
        const block = u8(rom, ANIM_BLOCKS + slot * 2 + i) & 0x3F;
        copy(rom, vram, 0x1C8000 + block * 0x200, 0x6C00 + i * 0x80, 0x80);
    }
    if (animSlot & 0x80) {
        const first = u8(rom, ANIM_SLOTS + (animSlot & 0x3F));
        const records = Math.min(8, (((u8(rom, ANIM_SLOTS + (animSlot & 0x3F) + 1) - first) * 2) & 0xFF) || 2);
        for (let k = 0; k < records; k++) {
            const block = u8(rom, ANIM_BLOCKS + first * 2 + k) & 0x3F;
            copy(rom, vram, 0x1C8000 + block * 0x200, 0x6C00 + k * 0x80, 0x80);
        }
    }
    const list = 0xCC0000 | u16(rom, LIST_POINTERS + charSet * 2);
    const len = u16(rom, LIST_POINTERS + charSet * 2 + 2) - (list & 0xFFFF);
    let at = 0;
    for (let y = 0; y + 2 < len; y += 3) {
        const w = u16(rom, list + y);
        at = loadEntry(rom, vram, at, w, u8(rom, list + y + 2) + 1);
    }
    return vram;
}

function loadEntry(rom: Rom, vram: Uint8Array, at: number, w: number, count: number): number {
    const kind = w >> 13;
    const idx = w & 0x1FFF;
    const base = (i: number) => offset(u24(rom, FORMAT_BASES + i * 3));
    if (kind >= 6) {
        const src = kind === 6 ? base(2) + idx * 32 : base(3) + idx * 64;
        const n = count * (kind === 6 ? 32 : 64);
        copy(rom, vram, src, at, n);
        return at + n;
    }
    if (kind >= 4) {
        const fill3 = w & 0x2000 ? 0xFF : 0;
        let src = base(1) + idx * 24;
        for (let c = 0; c < count; c++, src += 24, at += 32) {
            copy(rom, vram, src, at, 16);
            for (let r = 0; r < 8; r++) { vram[at + 16 + r * 2] = rom[src + 16 + r] ?? 0; vram[at + 17 + r * 2] = fill3; }
        }
        return at & 0xFFFF;
    }
    const fill2 = w & 0x4000 ? 0xFF : 0, fill3 = w & 0x2000 ? 0xFF : 0;
    // The carry out of the low 16 bits is dropped here (bit 12 of W bumps the bank instead).
    const b0 = base(0);
    let src = (b0 & 0xFF0000) + ((idx << 4) & 0x10000) + (((b0 & 0xFFFF) + (idx << 4)) & 0xFFFF);
    for (let c = 0; c < count; c++, src += 16, at += 32) {
        copy(rom, vram, src, at, 16);
        for (let r = 0; r < 8; r++) { vram[at + 16 + r * 2] = fill2; vram[at + 17 + r * 2] = fill3; }
    }
    return at & 0xFFFF;
}

function copy(rom: Rom, vram: Uint8Array, src: number, dst: number, n: number): void {
    for (let i = 0; i < n; i++) vram[(dst + i) & 0xFFFF] = rom[src + i] ?? 0;
}
