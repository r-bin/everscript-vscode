// Ownership: a room's chests — what the check action (the A button) finds in a cell (docs/terra/README.md §3.9).
// Pure: ROM bytes and a room id in, records out.
//
// The check action ($87:9199) looks at the cell in front of the player: a character there is talked to; else
// $87:C7AE looks the cell up in the room's list when it holds a closed chest (metatile $0F0, only while the player
// faces up), metatile $0F3, $0FA-$0FC, or a cell of type 4. The list: `$99:D859 + room × 2` points (bank $99) at
// records up to an `$FF` byte, the first whose cell is the one in front is taken:
//   +0 / +1  the cell
//   +2       flags: bit 7 — a gate flag follows (+3), the chest gives nothing until it is set; bit 6 — two
//            contents by a flag (not used in the base ROM); bits 3-4 — a variant ($7F:102C of the opening script)
//   then     the contents word (→ `$09C7`): an item, or with bit 15 set no item (the low bits are BCD digits —
//            30, 100, 378 …: most likely money, not checked); 0: empty
//   then     the opened flag n: event flag `$500 + n` is set when the chest is opened ($87:93FF), and a room load
//            draws the cell open (metatile + 1) when it is set ($8D:912B); 0: none
// Records are 7 bytes, 9 with bit 7 of the flags, 11 with bit 6.
const CHEST_TABLE = 0x99D859;
const MAX_CHESTS = 64;

export interface TerraChest {
    x: number; y: number;
    /** The flags byte. */
    flags: number;
    /** An event flag that must be set before the chest gives anything, or null. */
    gate: number | null;
    /** The contents word (bit 15: not an item). */
    contents: number;
    /** The event flag set when the chest is opened (`$500 + n`), or null. */
    opened: number | null;
    /** Bus address of the record. */
    at: number;
}

const file = (bus: number) => bus & 0x3FFFFF;
const word = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8);

/** Room `id`'s chest list (empty for a room the table has none for). */
export function roomChests(rom: Uint8Array, id: number): TerraChest[] {
    const bank = (CHEST_TABLE >> 16) << 16;
    const ptr = word(rom, file(CHEST_TABLE) + id * 2);
    const out: TerraChest[] = [];
    for (let at = file(bank | ptr), n = 0; rom[at] !== 0xFF && n < MAX_CHESTS && at + 7 <= rom.length; n++) {
        const flags = rom[at + 2];
        const extra = flags & 0x80 ? 2 : flags & 0x40 ? 4 : 0;
        const opened = word(rom, at + 5 + extra);
        out.push({ x: rom[at], y: rom[at + 1], flags, gate: flags & 0xC0 ? word(rom, at + 3) : null,
            contents: word(rom, at + 3 + extra), opened: opened ? 0x500 + opened : null, at: bank | (at & 0xFFFF) });
        at += 7 + extra;
    }
    return out;
}
