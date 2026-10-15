// Ownership: a map's piece placement list and assembling its two layers, as $00:CB90 does.
//
// $C8:5000 + id*2 points (bank $C8) to the list; the next map's pointer ends it.
// The list is $FE (following records go to layer A) or $FF (layer B) markers
// and 5-byte records:
//   0 event flag id     1 (min << 4) | max     2 piece index bits 0-7
//   3 x << 1 | bit 8    4 y << 1 | bit 9
// A record is placed only if min <= flag value <= max, the value being the
// byte at $7E:CF00 + flag id. The first placed piece of each layer gives that
// layer's size ($9C/$9D for A, $A0/$A1 for B); the map is layer A's size.
// Layer A ends up at $7F:0000, layer B at $7F:4000, $80 bytes per row.

import { Rom, u8, u16 } from './rom';
import { decodePiece, pieceSize, PieceSize } from './piece-decoder';

const PLACEMENT_POINTERS = 0xC85000;
export const LAYER_A = 0x0000;
export const LAYER_B = 0x4000;
export const ROW = 0x80;

export interface Placement {
    layer: 'A' | 'B';
    flag: number;
    min: number;
    max: number;
    piece: number;
    x: number;
    y: number;
}

export interface AssembledLayers {
    mem: Uint8Array;            // bank $7F image: layer A at 0, layer B at $4000
    sizeA: PieceSize | null;
    sizeB: PieceSize | null;
    placed: Placement[];
    skipped: Placement[];
}

/** Event flag values by flag id; the game reads them from $7E:CF00. */
export type FlagValues = (flag: number) => number;

export function readPlacements(rom: Rom, id: number): Placement[] {
    let p = 0xC80000 | u16(rom, PLACEMENT_POINTERS + id * 2);
    const end = 0xC80000 | u16(rom, PLACEMENT_POINTERS + id * 2 + 2);
    const out: Placement[] = [];
    let layer: 'A' | 'B' = 'A';
    while (p < end) {
        const b = u8(rom, p);
        if (b >= 0xFE) { layer = b === 0xFE ? 'A' : 'B'; p++; continue; }
        const range = u8(rom, p + 1), lo = u8(rom, p + 2), bx = u8(rom, p + 3), by = u8(rom, p + 4);
        out.push({
            layer, flag: b, min: range >> 4, max: range & 0x0F,
            piece: lo | (bx & 1) << 8 | (by & 1) << 9, x: bx >> 1, y: by >> 1,
        });
        p += 5;
    }
    return out;
}

/** Decode every visible piece of map `id` into a fresh bank $7F image. */
export function assembleLayers(rom: Rom, id: number, flags: FlagValues = () => 0): AssembledLayers {
    const mem = new Uint8Array(0x10000);
    const placed: Placement[] = [], skipped: Placement[] = [];
    let sizeA: PieceSize | null = null, sizeB: PieceSize | null = null;
    for (const r of readPlacements(rom, id)) {
        const v = flags(r.flag);
        if (v < r.min || v > r.max) { skipped.push(r); continue; }
        const base = r.layer === 'A' ? LAYER_A : LAYER_B;
        const size = decodePiece(rom, r.piece, mem, (base + r.y * ROW + r.x) & 0xFFFF);
        if (r.layer === 'A' && !sizeA) sizeA = size;
        if (r.layer === 'B' && !sizeB) sizeB = size;
        placed.push(r);
    }
    return { mem, sizeA, sizeB, placed, skipped };
}

/** Map size in cells (layer A's first visible piece) without decoding anything; null for an empty map. */
export function mapSize(rom: Rom, id: number, flags: FlagValues = () => 0): PieceSize | null {
    for (const r of readPlacements(rom, id)) {
        const v = flags(r.flag);
        if (r.layer === 'A' && v >= r.min && v <= r.max) return pieceSize(rom, r.piece);
    }
    return null;
}

/**
 * Maps with the same key draw the same picture: same character, palette and
 * metatile sets, display mode and the same assembled layers. Many map ids share
 * one picture and differ only in objects or event scripts. The layers are
 * compared, not the piece lists: the same pieces may be listed in another order
 * (map $8E lists two of $8B's pieces swapped).
 */
export function pictureKey(rom: Rom, id: number, header: number[], flags: FlagValues = () => 0): string {
    const { mem, sizeA, sizeB } = assembleLayers(rom, id, flags);
    const layer = (base: number, size: PieceSize | null): string => {
        if (!size) return '-';
        let h1 = 0x811C9DC5, h2 = 0x01000193;               // two FNV-1a style hashes over the rows
        for (let y = 0; y < size.h; y++) {
            for (let x = 0; x < size.w; x++) {
                const b = mem[(base + y * ROW + x) & 0xFFFF];
                h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
                h2 = Math.imul(h2 ^ b, 0x5BD1E995) >>> 0;
            }
        }
        return `${size.w}x${size.h}:${h1.toString(16)}${h2.toString(16)}`;
    };
    return [header[0], header[1], header[2], header[5] & 0x3F, layer(LAYER_A, sizeA), layer(LAYER_B, sizeB)].join(' ');
}
