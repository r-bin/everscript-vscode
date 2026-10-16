// Ownership: a room blob from a room's own parts — its graphics list, families and
// header given outright, not borrowed from a donor room (custom-room.ts borrows). Pure.
//
// The dictionary, the cuttable layer (Section 4) and the objects (Section 3) are
// built exactly as for a custom map (buildDictionary, encodeObjectArea), so the same
// rules hold: cuttable sources first, then first appearance, then object frames.
// Budgets are reported, not enforced: the caller decides what an oversized room means.

import { RoomModel, TriggerRecord, buildBlob, encodeBlock1, encodeBlock2, encodeBlock3 } from './encode';
import { buildDictionary, CustomObjectInput } from './custom-room';
import { encodeObjectArea } from './object-encode';

export interface OwnRoomInput {
    widthTiles: number;
    heightTiles: number;
    /** 13 header bytes (size and trigger origin are written from the fields above, origin 0). */
    header: ArrayLike<number>;
    /** Block 1: the graphic id of each slot. */
    graphics: number[];
    /** Family id per palette slot. */
    families: number[];
    /** Three words per cell, row by row. */
    cells: number[];
    /** `[x, y, l1, l2, cw]`: the cell shows these until cut, then its `cells` words. */
    cut?: number[][];
    objects?: CustomObjectInput[];
    stepOn?: TriggerRecord[];
    bTrigger?: TriggerRecord[];
}

export interface OwnRoomBlob {
    blob: Uint8Array;
    metatileCount: number;
    wramBytes: number;
    cuttable: number;
}

export function buildOwnRoomBlob(input: OwnRoomInput): OwnRoomBlob {
    const w = input.widthTiles | 0, h = input.heightTiles | 0;
    if (input.cells.length !== w * h * 3) throw new Error(`expected ${w * h * 3} words for a ${w}x${h} grid`);
    const base = w * h * 2;
    const dict = buildDictionary(input, w, h, base);
    const { objectOffsets, objectArea } = encodeObjectArea(input.objects || [], dict.grid, dict.key, base, w);
    const header = Uint8Array.from(input.header);
    header[0] = 0; header[1] = 0; header[2] = w; header[3] = h;
    const box = (t: TriggerRecord): TriggerRecord => ({ y1: t.y1, x1: t.x1, y2: t.y2, x2: t.x2, scriptId: t.scriptId & 0xffff });
    const model: RoomModel = {
        header,
        stepOn: (input.stepOn || []).map(box),
        bTrigger: (input.bTrigger || []).map(box),
        tileFamilies: input.families.slice(),
        extras: new Uint8Array(0),
        block1: encodeBlock1(input.graphics, true),
        section2Count: 0,
        section2Data: Uint8Array.from([0xff]),
        objectOffsets,
        block2: encodeBlock2(dict.grid, w, h, base, dict.sources),
        section4: dict.section4,
        block3: encodeBlock3(dict.l1, dict.l2, dict.cw, true),
        objectArea,
    };
    return { blob: buildBlob(model), metatileCount: dict.l1.length, wramBytes: base + dict.l1.length * 8, cuttable: dict.sources };
}
