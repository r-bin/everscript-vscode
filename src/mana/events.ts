// Ownership: which event a map runs on entry, and which one each cell runs when a
// character steps onto it.
//
// $C8:4000 + id*2 is a 16-bit pointer into bank $C8 to a list of event words; the game
// runs `word & $0FFF` through $01:E76D. Header byte 3 goes to $B8 ($00:C49C):
//   bit 2      word 0 is the map's own event ($00:BED3 -> $00:BEE5)
//   bits 0-1   b: how many cell events come before the special slots ($00:BEC9 sets
//              $4D = $C0 - b)
// On load $00:D03A numbers layer A's special cells (collision byte 1 bit 7) row by row
// and rewrites cell k to $C0 + k ($02:B517). When a character's cell changes
// ($00:D682 stores the new value in $E04B,X), $00:B637 takes any value v >= $C0 - b and
// runs word (v - ($C0 - b)) + (bit 2 ? 1 : 0). So the metatiles $C0-b..$BF are step
// events too, on every cell that shows them.
// Checked in the headless game for maps $10, $11 and $3E (tools/mana/check-events.js).

import { Rom, u16 } from './rom';
import { readHeader } from './header';
import { ManaMap } from './map';
import { collisionOf, specialOf } from './collision';

const EVENT_POINTERS = 0xC84000;
const EVENT_BANK = 0xC80000;
const SPECIAL_BASE = 0xC0;
const SLOTS = 64;                  // $02:B517 keeps the slot in one byte ORed with $C0

export interface StepEvent { x: number; y: number; event: number }

export interface MapEvents {
    /** The map's own event (header byte 3 bit 2), or null. */
    onEnter: number | null;
    /** Every layer-A cell that runs an event when stepped on, row by row. */
    steps: StepEvent[];
}

function eventWords(rom: Rom, id: number): number[] {
    const from = u16(rom, EVENT_POINTERS + id * 2), to = u16(rom, EVENT_POINTERS + id * 2 + 2);
    const words: number[] = [];
    for (let at = from; at + 1 < to && words.length < 256; at += 2) words.push(u16(rom, EVENT_BANK | at) & 0x0FFF);
    return words;
}

export function mapEvents(rom: Rom, map: ManaMap): MapEvents {
    const b3 = readHeader(rom, map.id).bytes[3];
    const lead = b3 & 3, own = (b3 & 4) ? 1 : 0;
    const words = eventWords(rom, map.id);
    const col = collisionOf(rom, map);
    const steps: StepEvent[] = [];
    let slot = 0;
    for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
            const n = map.cell('A', x, y);
            let v = n;
            if (specialOf(col.bytes[(y * map.w + x) * 4 + 1])) v = SPECIAL_BASE + (slot++ % SLOTS);
            if (v < SPECIAL_BASE - lead) continue;
            const event = words[v - (SPECIAL_BASE - lead) + own];
            // A word past the list reads whatever follows it; such cells are left out.
            if (event !== undefined) steps.push({ x, y, event });
        }
    }
    return { onEnter: own && words.length ? words[0] : null, steps };
}
