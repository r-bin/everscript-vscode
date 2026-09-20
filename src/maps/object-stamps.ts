// Ownership: the Section 3 object *stamp table* header — the record a state's
// `metatileId` points at. Pure.
//
// THIS DIVERGES FROM UPSTREAM, deliberately, and only for the header.
//
// `dump_room.py` reads the record as `[tw][th]` followed by `tw*th` 16-bit
// words starting at +2. That over-reads: there is a tile mask between the
// dimensions and the words, and only the set bits have a word. Evidence:
//
//   - Room 0x2c has one object with 11 states whose stamp records are
//     contiguous, so every record's exact length is known from the next
//     pointer. Lengths run 7, 5, 5, 5, 7, 11, 11, 9 — and
//     `2 + ceil(tw*th/8) + popcount(mask) * 2` predicts every one of them,
//     including the 9 (a 2x2 stamp with a 3-bit mask, 0x07).
//   - Across all 127 vanilla rooms, that formula explains 78.6% of the 2713
//     records whose length is pinned by the next pointer. (The rest are
//     records with unreferenced tables in the gap, so their "length" is not
//     actually known.) Solving for the mask length per record gives
//     ceil(tw*th/8) in 2048 of 2132 cases.
//
// What is still NOT decoded is what the 16-bit words mean. They are not
// absolute metatile IDs, not baseMetatile-relative ones, and an object's
// state 0 does not reproduce the loaded grid (the Markov grid is base terrain;
// objects stamp over it at load), so there is no oracle to check a guess
// against. `words` is therefore exposed as raw bytes for comparison only —
// never resolve it to a metatile and draw it. See gap 1.9 in
// docs/map-port-gap-analysis.md.

import { read16 } from './rom';

export interface ObjectStamp {
    /** Footprint width in metatiles. */
    tw: number;
    /** Footprint height in metatiles. */
    th: number;
    /** Which tiles of the tw*th footprint this state writes, LSB-first. */
    mask: number[];
    /** How many tiles the mask selects. */
    tileCount: number;
    /** Raw 16-bit words, one per set mask bit. Meaning undecoded — do not render. */
    words: number[];
    /** Total record length in bytes, if the parse is self-consistent. */
    byteLength: number;
    /**
     * False when the record does not parse as a stamp at all — zero
     * dimensions, an absurd footprint, or a mask selecting more tiles than the
     * footprint holds. Callers should treat the extent as unknown, not zero.
     */
    valid: boolean;
}

function popcount(b: number): number {
    let c = 0;
    let v = b;
    while (v) { c += v & 1; v >>>= 1; }
    return c;
}

/** Largest footprint accepted before treating the record as misparsed. */
const MAX_TILES = 4096;

/**
 * Parse the stamp record at `objectArea + pointer`.
 *
 * Never throws: a record that does not parse comes back with `valid: false`
 * so the caller can say "unknown" rather than draw a confident wrong box.
 */
export function parseObjectStamp(rom: Uint8Array, objectArea: number, pointer: number): ObjectStamp {
    const p = objectArea + pointer;
    const empty: ObjectStamp = { tw: 0, th: 0, mask: [], tileCount: 0, words: [], byteLength: 0, valid: false };
    if (p < 0 || p + 2 > rom.length) return empty;

    const tw = rom[p];
    const th = rom[p + 1];
    const n = tw * th;
    if (!tw || !th || n > MAX_TILES) return empty;

    const maskBytes = Math.ceil(n / 8);
    if (p + 2 + maskBytes > rom.length) return empty;
    const mask: number[] = [];
    let tileCount = 0;
    for (let i = 0; i < maskBytes; i++) {
        mask.push(rom[p + 2 + i]);
        tileCount += popcount(rom[p + 2 + i]);
    }
    // More set bits than tiles means this is not a stamp record.
    if (tileCount > n) return { ...empty, tw, th };

    const wordsAt = p + 2 + maskBytes;
    if (wordsAt + tileCount * 2 > rom.length) return { ...empty, tw, th };
    const words: number[] = [];
    for (let i = 0; i < tileCount; i++) words.push(read16(rom, wordsAt + i * 2));

    return { tw, th, mask, tileCount, words, byteLength: 2 + maskBytes + tileCount * 2, valid: true };
}

/**
 * A stable string for "these two states stamp the same thing".
 *
 * Compares the whole record — extent, mask and words — so it is exact even
 * though the words' meaning is unknown: identical bytes stamp identical tiles
 * whatever they turn out to mean. Used to spot objects whose states differ
 * only in position, which are nothing to choose between.
 */
export function objectStampSignature(stamp: ObjectStamp): string {
    if (!stamp.valid) return '';
    return stamp.tw + 'x' + stamp.th + ':' + stamp.mask.join('.') + ':' + stamp.words.join('.');
}
