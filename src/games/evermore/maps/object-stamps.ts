// Ownership: Section 3 object stamp records — the data a state transition
// writes into the metatile grid. Pure.
//
// DIVERGES FROM UPSTREAM. `dump_room.py` reads the record as `[tw][th]`
// followed by `tw*th` 16-bit words, and treats those words as metatile IDs.
// Both halves are wrong, which is why none of them ever resolved.
//
// The real format, read straight off $90A4C2..$90A4F2 in a Mesen trace of
// looting a chest on map 0x71 (object 0x14):
//
//   [tw: 1][th: 1]
//   then, for tiles 0..tw*th-1 in row-major order, an inline bit stream:
//     a mask byte supplies 8 bits, LSB first ($90A4C9 loads it, ORAs in a
//     sentinel and shifts — so a fresh byte is fetched every 8 tiles);
//     bit set   -> a 16-bit value follows inline, consumed here
//     bit clear -> this tile is left alone
//
// And the decisive part, $90A4E8:
//
//     TXA                 ; X = the metatile id currently in the grid
//     EOR [$B0]           ; ^ the value from the record
//     STA [$AD]           ; -> back into the grid at $7F0000 + (y*w + x)*2
//
// The values are **XOR deltas, not metatile IDs**. In the trace,
// 0x5CC8 ^ 0x2470 = 0x78B8 and 0x5CD0 ^ 0x2410 = 0x78C0, matching the writes
// exactly. XOR is an involution, so one record both applies and undoes a
// transition — which is how $90A44B..$90A45E walks the displayed state toward
// the target one step at a time.
//
// So a record is the delta *between* two states, not a state: descriptor `s`
// turns state `s` into state `s+1`. An object with `max_state` descriptors has
// `max_state + 1` appearances, state 0 being the grid as decoded.
//
// Verified across all 127 vanilla rooms: the record length this predicts
// matches the next record's offset for 2726 of 2726 records (100%), and
// applying the deltas cumulatively lands on a metatile ID that exists in the
// room's Block 3 table for 19797 of 19797 tile writes (100%).

import { read16 } from './rom';

export interface ObjectStamp {
    /** Footprint width in metatiles. */
    tw: number;
    /** Footprint height in metatiles. */
    th: number;
    /**
     * One entry per tile of the `tw * th` footprint, row-major. `null` means
     * the mask bit was clear and the tile is untouched.
     */
    deltas: Array<number | null>;
    /** How many tiles this record actually writes. */
    tileCount: number;
    /** Total record length in bytes. */
    byteLength: number;
    /** False when the bytes cannot be a stamp record at all. */
    valid: boolean;
}

/** Largest footprint accepted before treating the record as misparsed. */
const MAX_TILES = 4096;

const EMPTY: ObjectStamp = { tw: 0, th: 0, deltas: [], tileCount: 0, byteLength: 0, valid: false };

/**
 * Parse the stamp record at `objectArea + pointer`.
 *
 * Never throws: a record that runs off the end of the ROM comes back invalid
 * so a caller can say "unknown" rather than stamp garbage.
 */
export function parseObjectStamp(rom: Uint8Array, objectArea: number, pointer: number): ObjectStamp {
    const p = objectArea + pointer;
    if (p < 0 || p + 2 > rom.length) return EMPTY;

    const tw = rom[p];
    const th = rom[p + 1];
    const n = tw * th;
    if (!tw || !th || n > MAX_TILES) return EMPTY;

    const deltas: Array<number | null> = [];
    let q = p + 2;
    let mask = 0;
    let bit = 8;
    let tileCount = 0;
    for (let k = 0; k < n; k++) {
        if (bit === 8) {
            if (q >= rom.length) return { ...EMPTY, tw, th };
            mask = rom[q++];
            bit = 0;
        }
        const set = (mask >> bit) & 1;
        bit += 1;
        if (!set) { deltas.push(null); continue; }
        if (q + 2 > rom.length) return { ...EMPTY, tw, th };
        deltas.push(read16(rom, q));
        q += 2;
        tileCount += 1;
    }

    return { tw, th, deltas, tileCount, byteLength: q - p, valid: true };
}

/**
 * A stable string for "these two records write the same thing".
 *
 * Used to spot objects whose states differ only in where they sit, which are
 * nothing to choose between.
 */
export function objectStampSignature(stamp: ObjectStamp): string {
    if (!stamp.valid) return '';
    return stamp.tw + 'x' + stamp.th + ':' + stamp.deltas.map((d) => (d === null ? '-' : d)).join('.');
}
