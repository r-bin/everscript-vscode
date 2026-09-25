// Ownership: turning a custom map — a grid of resolved stamps drawn with a
// donor room's graphics — into a room blob the engine can load. Pure.
//
// The editor never writes ids; it hands over each cell's three words
// (Layer 1, Layer 2, collision). This file builds the dictionary from them,
// numbers it the one way the Markov encoder accepts, and borrows everything
// else from the donor exactly as the editor's renderer did, so the room the
// game loads is the room the editor drew.
//
// See docs/map-format/map_encoding.md and rom-export.md.

import { decodeRoom } from './room';
import { RoomModel, buildBlob, encodeBlock1, encodeBlock2, encodeBlock3, modelFromRom } from './encode';
import { MAX_WRAM } from './budget';
import { MIN_TILES, MAX_TILES } from './blank-room';

export interface CustomRoomInput {
    /** The room whose graphics and families the map was drawn with. */
    borrowFrom: number;
    widthTiles: number;
    heightTiles: number;
    /** Row-major, three words per cell: `[l1, l2, cw, l1, l2, cw, ...]`. */
    cells: number[];
    /** Graphics the draft adopted, slotted after the donor's whole tile list. */
    graphics?: number[];
    /** The draft's tile families; empty means the donor's. */
    families?: number[];
}

export interface CustomRoomBlob {
    blob: Uint8Array;
    model: RoomModel;
    metatileCount: number;
    wramBytes: number;
}

/**
 * Header bytes 0 and 1 are the trigger origin, added to the player's tile
 * position during trigger checks (`$0F86`, map_decompression_trace_analysis
 * §1). A custom map writes no triggers, so its origin is 0 — the same as
 * Brian's own room.
 */
const HEADER_ORIGIN_X = 0;
const HEADER_ORIGIN_Y = 1;

/**
 * An empty Section 2: no animated tiles. Byte-for-byte what rooms 0x15,
 * 0x34 and 0x76 carry (`count 0`, a one-byte payload of `ff`).
 */
const EMPTY_SECTION2 = Uint8Array.from([0xff]);

/** Section 4 with `$0FC4 = 0` and no swap records, as in 0x15, 0x34 and 0x76. */
const EMPTY_SECTION4 = Uint8Array.from([0x00]);

/**
 * Build the blob.
 *
 * **Dictionary order.** Entries are numbered by first appearance, reading
 * the grid row by row. That is the one order that always encodes: every new
 * id is then exactly the Markov encoder's "next sequential metatile", the
 * only token that widens its literal field (encode.ts). Cell (0,0) becomes
 * entry 0, which rule 7.2 requires.
 *
 * **Graphics.** The editor numbers slots over the donor's *whole* tile list
 * — Block 1 then its animated tiles (`tiles.count`, metatile-palette.js) —
 * and appends adopted graphics after that. So Block 1 here is exactly that
 * list, in that order, with the animated tiles written as ordinary ones and
 * Section 2 left empty. Every word the editor drew names the same graphic in
 * the game. The donor's animation is lost, which a custom map never drew.
 */
export function buildCustomRoomBlob(rom: Uint8Array, input: CustomRoomInput): CustomRoomBlob {
    const w = input.widthTiles | 0;
    const h = input.heightTiles | 0;
    if (w < MIN_TILES || h < MIN_TILES || w > MAX_TILES || h > MAX_TILES) {
        throw new Error(`a ${w}x${h} room is outside ${MIN_TILES}..${MAX_TILES} tiles a side`);
    }
    if (!Array.isArray(input.cells) || input.cells.length !== w * h * 3) {
        throw new Error(`expected ${w * h * 3} words for a ${w}x${h} grid, got ${input.cells && input.cells.length}`);
    }

    const donor = modelFromRom(rom, input.borrowFrom);
    const donorRoom = decodeRoom(rom, input.borrowFrom);

    const base = w * h * 2;
    const key = new Map<string, number>();
    const l1: number[] = [];
    const l2: number[] = [];
    const cw: number[] = [];
    const grid = new Array<number>(w * h);
    for (let i = 0; i < w * h; i++) {
        const a = input.cells[i * 3] & 0xffff;
        const b = input.cells[i * 3 + 1] & 0xffff;
        const c = input.cells[i * 3 + 2] & 0xffff;
        const k = a + ',' + b + ',' + c;
        let idx = key.get(k);
        if (idx === undefined) {
            idx = l1.length;
            key.set(k, idx);
            l1.push(a); l2.push(b); cw.push(c);
        }
        grid[i] = base + idx * 8;
    }

    const wramBytes = base + l1.length * 8;
    if (wramBytes > MAX_WRAM) {
        throw new Error(`the grid and ${l1.length} stamps need ${wramBytes} bytes of the ${MAX_WRAM}-byte window`);
    }

    const header = donor.header.slice();
    header[HEADER_ORIGIN_X] = 0;
    header[HEADER_ORIGIN_Y] = 0;
    header[2] = w;
    header[3] = h;

    const graphics = donorRoom.tilePalette
        .concat(donorRoom.animatedTiles)
        .concat((input.graphics || []).map(Number));
    const families = input.families && input.families.length ? input.families.map(Number) : donor.tileFamilies;

    const model: RoomModel = {
        header,
        stepOn: [],
        bTrigger: [],
        tileFamilies: families,
        extras: donor.extras,
        block1: encodeBlock1(graphics, true),
        section2Count: 0,
        section2Data: EMPTY_SECTION2,
        objectOffsets: [],
        block2: encodeBlock2(grid, w, h, base, 0),
        section4: EMPTY_SECTION4,
        block3: encodeBlock3(l1, l2, cw, true),
        objectArea: new Uint8Array(0),
    };
    return { blob: buildBlob(model), model, metatileCount: l1.length, wramBytes };
}
