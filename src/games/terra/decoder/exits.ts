// Ownership: a room's exits — the rectangles that take the player to another room (docs/terra/README.md §3.7).
// Pure: ROM bytes and a room id in, plain records out.
//
// Every frame the main loop runs $8D:8797: unless bit 4 of `$097C` is set it walks the room's list at
// `$81:8000 + room × 2` (12 bytes per exit, up to an `$FF` byte) and takes the first exit whose cell rectangle
// holds the player's cell (`$0962` / `$0964`) and whose pixel rectangle holds the player's 16 px box (`$095E` /
// `$0960`). Taking it ($8D:883E) writes the next room `$047C`, the two style bytes `$0484` / `$0490` and the
// arrival position `$0492` / `$0494`; the room change ($8D:8717) then loads that room.
//
// An exit's room word with bit 15 set points (bank $81) at a list of choices instead ($8D:8911): 10 bytes each —
// an event flag, the room, the two style bytes, the arrival x and y — up to a flag $FFFF (no exit). The first
// choice whose flag is set is taken (clear, when bit 7 of the exit's byte 6 is set); flag 0 always is. Event flags
// are bits of `$7E:06C0` (flag n: byte n >> 3, bit n & 7; tested by $80:BBA6).

/** The exit list pointers (bank $81, the data bank of the main loop). */
const EXIT_TABLE = 0x818000;
/** The bank the lists, records and choices are in. */
const BANK = (EXIT_TABLE >> 16) << 16;
const EXIT_SIZE = 12, CHOICE_SIZE = 10, MAX_EXITS = 255, MAX_CHOICES = 16;

/** Where an exit leads: a room and the arrival point in its pixels; `flag` is the event flag a choice needs. */
export interface ExitTarget {
    room: number;
    x: number; y: number;
    /** `$0484` and `$0490` (the low nibble picks the player's arrival script, $8D:895B). */
    style: [number, number];
    /** For a choice: the event flag (0: always), else null. */
    flag: number | null;
}

export interface TerraExit {
    /** The rectangle, in 16 px cells. */
    x: number; y: number; w: number; h: number;
    /** One target, or the choices in the order the game tries them. */
    targets: ExitTarget[];
    /** Choices taken when their flag is clear rather than set (byte 6 bit 7). */
    inverted: boolean;
    /** Bus address of the 12-byte record. */
    at: number;
}

const file = (bus: number) => bus & 0x3FFFFF;
const word = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8);

/** Room `id`'s exits (none for a room the table has no list for). */
export function roomExits(rom: Uint8Array, id: number): TerraExit[] {
    const ptr = word(rom, file(EXIT_TABLE) + id * 2);
    if (!ptr) return [];
    const out: TerraExit[] = [];
    for (let at = file(BANK | ptr), n = 0; rom[at] !== 0xFF && n < MAX_EXITS && at + EXIT_SIZE <= rom.length; at += EXIT_SIZE, n++) {
        const room = word(rom, at + 4);
        const targets: ExitTarget[] = [];
        if (room & 0x8000) {
            for (let c = file(BANK | room), k = 0; k < MAX_CHOICES; c += CHOICE_SIZE, k++) {
                const flag = word(rom, c);
                if (flag === 0xFFFF) break;
                targets.push({ flag, room: word(rom, c + 2), style: [rom[c + 4], rom[c + 5]], x: word(rom, c + 6), y: word(rom, c + 8) });
                if (flag === 0) break;
            }
        } else {
            targets.push({ flag: null, room, style: [rom[at + 6], rom[at + 7]], x: word(rom, at + 8), y: word(rom, at + 10) });
        }
        out.push({ x: rom[at], y: rom[at + 1], w: rom[at + 2], h: rom[at + 3], targets,
            inverted: !!(room & 0x8000) && !!(rom[at + 6] & 0x80), at: BANK | (at & 0xFFFF) });
    }
    return out;
}
