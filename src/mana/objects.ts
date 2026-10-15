// Ownership: a map's objects — the 8-byte records after its header that the game turns
// into characters (enemies, people) when the map loads.
//
// $00:C481 (end): the list starts 8 bytes after the header ($C8:7000 + id*2), its address
// goes to $7E:E802 and its length (next map's header - list) / 8 to $7E:E800. $00:DCE3
// copies every record into the table at $7E:C800 (16 bytes each, $00:DD55): bytes 0-7 to
// +8..+15, +0 = 1 (in use), +7 = (byte 3 & $80) | (byte 2 >> 1 & $40). A list of $31 or
// more records stops the game in a loop there ($00:DCE8), so no played map has one.
// When a record is spawned, +0 becomes $81 and +3 the entity slot.
// Checked in the game (maps $10 and $81): every record is copied, and each spawned entity
// stands at (byte 2 & $7F, byte 3 & $7F) * 16 + 4 pixels (docs/mana/README.md "Objects").
// Not named yet: bytes 0, 1, 4, 5 and the kind word (bytes 6-7; $C001 is 1350 of 2179).

import { Rom, u8, u16 } from './rom';
import { headerAddress } from './header';

const HEADER_POINTERS = 0xC87000;
const MAX_OBJECTS = 0x31;

export interface ManaObject {
    index: number;
    /** Cell position (16x16 cells). */
    x: number;
    y: number;
    /** $C807's two bits: $80 = byte 3 bit 7, $40 = byte 2 bit 7. */
    flags: number;
    /** Bytes 6-7, little-endian. */
    kind: number;
    bytes: number[];
}

export function mapObjects(rom: Rom, id: number): ManaObject[] {
    const at = headerAddress(rom, id) + 8;
    const end = 0xC80000 | u16(rom, HEADER_POINTERS + id * 2 + 2);
    const count = Math.floor((end - at) / 8);
    if (count <= 0 || count >= MAX_OBJECTS) return [];
    const out: ManaObject[] = [];
    for (let i = 0; i < count; i++) {
        const b: number[] = [];
        for (let k = 0; k < 8; k++) b.push(u8(rom, at + i * 8 + k));
        out.push({ index: i, x: b[2] & 0x7F, y: b[3] & 0x7F, flags: (b[3] & 0x80) | ((b[2] >> 1) & 0x40),
            kind: b[6] | (b[7] << 8), bytes: b });
    }
    return out;
}
