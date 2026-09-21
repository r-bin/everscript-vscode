// Ownership: what a room spends against the four hardware ceilings, and what
// an edit would add to that. Pure.
//
// Every ceiling here is measured, and the two that are not hardware-proven
// say so. See docs/map-format/building-a-room-from-a-picture.md §4.

import { RoomData } from './room';

/**
 * Graphics slots reachable through a tilemap word.
 *
 * A word's `chr` field is 10 bits and `chr -> slot` is
 * `floor(chr/0x20)*8 + floor((chr%0x20)/2)`, so slots 0..263 can be named.
 * The fullest vanilla room is `0x08` at **255** (237 Block 1 + 18 animated),
 * which leaves nine.
 */
export const MAX_GRAPHICS = 264;

/** Background palette slots. Hard: the loader clamps to 7 at `$90D037`. */
export const MAX_FAMILIES = 7;

/**
 * Bytes the grid and the dictionary share at `$7F0000`.
 *
 * Not traced as a hardware limit. The largest vanilla room (`0x65`) uses
 * 32680 of it, which is consistent with a 32 KB window and is the reason to
 * warn rather than refuse past the vanilla maximum.
 */
export const MAX_WRAM = 32768;

/** The vanilla high-water marks, for "you are past anything the game does". */
export const VANILLA_MAX = { graphics: 255, stamps: 2131, wram: 32680 } as const;

export interface BudgetLine {
    used: number;
    /** The ceiling, or `null` where none is known. */
    max: number | null;
    /** The largest value any vanilla room reaches. */
    vanilla: number;
}

export interface RoomBudget {
    graphics: BudgetLine;
    families: BudgetLine;
    stamps: BudgetLine;
    wram: BudgetLine;
}

/** Bytes the grid plus the dictionary occupy. */
export function wramBytes(widthTiles: number, heightTiles: number, metatileCount: number): number {
    return widthTiles * heightTiles * 2 + metatileCount * 8;
}

/** What this room already spends. */
export function roomBudget(room: RoomData): RoomBudget {
    const graphics = room.tilePalette.length + room.animatedTiles.length;
    return {
        graphics: { used: graphics, max: MAX_GRAPHICS, vanilla: VANILLA_MAX.graphics },
        // A room listing 14 families has two sets swapped at runtime; seven
        // is what is resident, so that is what the meter measures against.
        families: { used: Math.min(room.tileFamilies.length, MAX_FAMILIES), max: MAX_FAMILIES, vanilla: MAX_FAMILIES },
        stamps: { used: room.metatileCount, max: null, vanilla: VANILLA_MAX.stamps },
        wram: {
            used: wramBytes(room.header.widthTiles, room.header.heightTiles, room.metatileCount),
            max: MAX_WRAM,
            vanilla: VANILLA_MAX.wram,
        },
    };
}

/** A stamp as the dictionary stores it — the unit find-or-create works on. */
export interface StampTriple {
    layer1: number;
    layer2: number;
    collision: number;
}

/** What placing something would add to a room that already has some of it. */
export interface MarginalCost {
    graphics: number;
    families: number;
    stamps: number;
    wram: number;
    /** Which lines would end up past their ceiling. */
    over: string[];
}

/**
 * The cost of adding these graphics, families and stamps to this room.
 *
 * Marginal, not absolute: the gourd in room `0x34` is 10 graphics and 3
 * families in an empty room, and close to free in a room that already drew
 * one. A stamp whose three words exactly match an existing entry costs
 * nothing — that is the find-or-create rule the composer already applies,
 * and it is why placing the same object twice is only grid cells.
 */
export function marginalCost(
    room: RoomData,
    add: { graphics?: number[]; families?: number[]; stamps?: StampTriple[] },
): MarginalCost {
    const budget = roomBudget(room);

    const haveGraphics = new Set(room.tilePalette.concat(room.animatedTiles));
    const newGraphics = new Set((add.graphics || []).filter((g) => !haveGraphics.has(g)));

    const haveFamilies = new Set(room.tileFamilies);
    const newFamilies = new Set((add.families || []).filter((f) => !haveFamilies.has(f)));

    const { layer1, layer2, collision } = room.metatileSlices;
    const haveStamps = new Set<string>();
    for (let i = 0; i < room.metatileCount; i++) {
        haveStamps.add(`${layer1[i] ?? 0},${layer2[i] ?? 0},${collision[i] ?? 0}`);
    }
    let newStamps = 0;
    for (const s of add.stamps || []) {
        const key = `${s.layer1},${s.layer2},${s.collision}`;
        if (haveStamps.has(key)) continue;
        haveStamps.add(key); // a duplicate inside the batch is also free
        newStamps += 1;
    }

    const over: string[] = [];
    if (budget.graphics.used + newGraphics.size > MAX_GRAPHICS) over.push('graphics');
    if (budget.families.used + newFamilies.size > MAX_FAMILIES) over.push('families');
    if (budget.wram.used + newStamps * 8 > MAX_WRAM) over.push('wram');

    return {
        graphics: newGraphics.size,
        families: newFamilies.size,
        stamps: newStamps,
        wram: newStamps * 8,
        over,
    };
}
