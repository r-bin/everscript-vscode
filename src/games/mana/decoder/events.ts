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
// events too, on every cell that shows them. The movement code ($01:B9A3) keeps a character out
// of a cell of value >= $C0 - b unless the cell's c1 has bit 6: the event of such a solid cell runs
// when a character walks into it (the sword in the stone at Potos Falls, signposts), the others
// when one walks onto it. What a cell looks like (`looks`): c1 $87 a signpost, $86 a cave
// entrance; a door is a walk-into cell ($80) one or two wide in a wall face: wall on both
// sides, a plain wall above (c0 $13, sprite priority 6), floor below. Checked by eye on 24
// samples from every map: the 12 that match are all doors; of those that do not, 3 are doors
// too (unusual walls), the rest cave openings and a monument.
// Checked in the headless game for maps $10, $11 and $3E (tools/mana/check-events.js).

import { Rom, u16 } from './rom';
import { readHeader } from './header';
import { ManaMap } from './map';
import { collisionOf, specialOf } from './collision';

const EVENT_POINTERS = 0xC84000;
const EVENT_BANK = 0xC80000;
const SPECIAL_BASE = 0xC0;
const SLOTS = 64;                  // $02:B517 keeps the slot in one byte ORed with $C0

export interface StepEvent {
    x: number; y: number; event: number;
    /** Solid (c1 bit 6 clear): the event runs when a character walks into the cell, not onto it. */
    bump: boolean;
    /** What the cell looks like, where its data says so; null when it does not. */
    looks: 'signpost' | 'door' | 'cave' | null;
}

export interface MapEvents {
    /** The map's own event (header byte 3 bit 2), or null. */
    onEnter: number | null;
    /** Every layer-A cell that runs an event when walked onto or into, row by row. */
    steps: StepEvent[];
}

/**
 * The map's event words, `count` of them from its pointer. The game does not stop at the next
 * map's pointer: maps $64-$6C (Potos) have empty lists at $48DE and their doors run the words
 * there (map $6D's list), $101's those of $102 (tools/mana/check-events.js: 9 of 9, 2 of 2).
 */
function eventWords(rom: Rom, id: number, count: number): number[] {
    const from = u16(rom, EVENT_POINTERS + id * 2);
    const words: number[] = [];
    for (let k = 0; k < count; k++) words.push(u16(rom, EVENT_BANK | ((from + k * 2) & 0xFFFF)) & 0x0FFF);
    return words;
}

/** Walk-into cells ($80) one or two wide in a wall face: `looks` = 'door'. */
function markDoors(map: ManaMap, bytes: Uint8Array, steps: StepEvent[]) {
    const at = new Map(steps.map((s) => [s.y * map.w + s.x, s]));
    const byte = (x: number, y: number, k: number) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? -1 : bytes[(y * map.w + x) * 4 + k]);
    const wall = (x: number, y: number) => byte(x, y, 0) >= 0 && (byte(x, y, 0) & 7) === 3;
    const floor = (x: number, y: number) => byte(x, y, 0) >= 0 && (byte(x, y, 0) & 7) !== 3 && !at.has(y * map.w + x);
    const plainWall = (x: number, y: number) => byte(x, y, 0) === 0x13 && (byte(x, y, 1) & 7) === 6;
    for (const s of steps) {
        if (byte(s.x, s.y, 1) !== 0x80 || at.has(s.y * map.w + s.x - 1)) continue;          // the run's first cell
        let end = s.x;
        while (at.has(s.y * map.w + end + 1) && byte(end + 1, s.y, 1) === 0x80) end++;
        if (end - s.x > 1 || !wall(s.x - 1, s.y) || !wall(end + 1, s.y)) continue;
        let door = true;
        for (let x = s.x; x <= end; x++) if (!plainWall(x, s.y - 1) || !floor(x, s.y + 1)) door = false;
        if (door) for (let x = s.x; x <= end; x++) at.get(s.y * map.w + x)!.looks = 'door';
    }
}

export function mapEvents(rom: Rom, map: ManaMap): MapEvents {
    const b3 = readHeader(rom, map.id).bytes[3];
    const lead = b3 & 3, own = (b3 & 4) ? 1 : 0;
    const words = eventWords(rom, map.id, own + lead + SLOTS);
    const col = collisionOf(rom, map);
    const steps: StepEvent[] = [];
    let slot = 0;
    for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
            const n = map.cell('A', x, y);
            let v = n;
            const c1 = col.bytes[(y * map.w + x) * 4 + 1];
            if (specialOf(c1)) v = SPECIAL_BASE + (slot++ % SLOTS);
            if (v < SPECIAL_BASE - lead) continue;
            const event = words[v - (SPECIAL_BASE - lead) + own];
            steps.push({ x, y, event, bump: !(c1 & 0x40), looks: c1 === 0x87 ? 'signpost' : c1 === 0x86 ? 'cave' : null });
        }
    }
    markDoors(map, col.bytes, steps);
    return { onEnter: own ? words[0] : null, steps };
}
