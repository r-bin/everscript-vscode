// Ownership: Evermore's 16x16 graphics as a converted room (imports/mana, imports/terra) builds
// them — the graphic layout, the tilemap word's character field for a Block 1 slot, and the
// graphics list (deduplicated, mirrored copies sharing a slot). Pure; game-neutral.

import { MAX_GRAPHICS } from './ids';
import { flipH, flipV, keyOf } from './pixels';

type Placed = { slot: number; h: number; v: number };

const EMPTY_GRAPHIC = 0;        // slot 0 is always the fully transparent graphic

/** Evermore's 16x16 graphic layout: four 8x8 4bpp planar characters, TL TR BL BR. */
function encodeGraphic(px: Uint8Array): Uint8Array {
    const out = new Uint8Array(128);
    for (let s = 0; s < 4; s++) {
        const ox = (s & 1) * 8, oy = (s >> 1) * 8;
        for (let row = 0; row < 8; row++) {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
            for (let col = 0; col < 8; col++) {
                const c = px[(oy + row) * 16 + ox + col], m = 1 << (7 - col);
                if (c & 1) b0 |= m; if (c & 2) b1 |= m; if (c & 4) b2 |= m; if (c & 8) b3 |= m;
            }
            out[s * 32 + row * 2] = b0; out[s * 32 + row * 2 + 1] = b1;
            out[s * 32 + row * 2 + 16] = b2; out[s * 32 + row * 2 + 17] = b3;
        }
    }
    return out;
}

/** Block 1 slot -> character index of a tilemap word (the inverse of `floor(chr/0x20)*8 + floor(chr%0x20/2)`). */
const slotChr = (slot: number): number => Math.floor(slot / 8) * 0x20 + (slot % 8) * 2;

/** The graphics list: deduplicated, mirrored copies sharing one slot. */
function graphicTable(stats: { droppedGraphics: number }) {
    const slots: Uint8Array[] = [new Uint8Array(256)], index = new Map<string, number>([[keyOf(slots[0]), 0]]);
    return {
        slots,
        /** {slot, h, v} for a pixel block, adding it when it is new. */
        place(px: Uint8Array): Placed {
            const tries: [Uint8Array, number, number][] = [[px, 0, 0], [flipH(px), 1, 0], [flipV(px), 0, 1], [flipV(flipH(px)), 1, 1]];
            for (const [p, h, v] of tries) {
                const s = index.get(keyOf(p));
                if (s !== undefined) return { slot: s, h, v };
            }
            if (slots.length >= MAX_GRAPHICS) { stats.droppedGraphics++; return { slot: EMPTY_GRAPHIC, h: 0, v: 0 }; }
            index.set(keyOf(px), slots.length);
            slots.push(px);
            return { slot: slots.length - 1, h: 0, v: 0 };
        },
    };
}

export type { Placed };
export { EMPTY_GRAPHIC, encodeGraphic, slotChr, graphicTable };
