// Ownership: the ROM's own catalogue of animations — the record table at $C4:0000 (what $90:8124
// starts), its facing groups, and the global id table. Pure. ./animation-vm runs the scripts.

import { snesToRom, readByte } from './rom';
import { busU16 } from '../../../platform/snes/hirom';

const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));
const read16At = (rom: Uint8Array, snes: number): number => busU16(rom, snes);

/**
 * The animation records: `$C40000 + record`, 4 bytes each, from `$C43E3A` to
 * `$C45999`. Every character and weapon field, and every global id, points
 * at a record inside this range and at the head of a facing group.
 */
/** The animation records: `[script:u16][bank:u8][flags:u8]` ($90:8124). */
export const ANIMATION_TABLE = 0xc40000;
export const RECORD_FIRST = 0x3e3a;
export const RECORD_END = 0x599a;
const RECORD_SIZE = 4;

/**
 * Global animation ids: `animate(entity, mode, id)` with `id < 0x8000` reads
 * `$C43C92 + id` (`$8CE13C LDA $C43C92,X`); ids at or above `0x8000` are the
 * character's own record fields instead. 212 words, ending where the record
 * table begins.
 */
export const ANIMATION_ID_TABLE = 0xc43c92;
export const ANIMATION_ID_COUNT = (0xc40000 + RECORD_FIRST - ANIMATION_ID_TABLE) / 2;

const DIRECTIONAL_8 = 0x80;       // $908128: record + 2 * facing
const DIRECTIONAL_4 = 0x40;       // $90812A: record + table[facing]

/** The facing each record of a group serves, in record order. */
const FACINGS_8 = [0, 2, 4, 6, 8, 10, 12, 14];
const FACINGS_4 = [0, 4, 8, 12];

/** One animation: a head record and the records its facings select. */
export interface AnimationGroup {
    record: number;
    flags: number;
    /** Facing index served by each record of the group. */
    facings: number[];
    /** Script address for each record of the group. */
    scripts: number[];
}

/** The script an animation record points at, as it stands (no facing applied). */
export function recordScript(rom: Uint8Array, record: number): number {
    return (read16At(rom, ANIMATION_TABLE + record) | (at(rom, ANIMATION_TABLE + record + 2) << 16)) >>> 0;
}

/** Every animation in the record table, in record order. */
const startsCache = new WeakMap<Uint8Array, Set<number>>();
/** Every script address some record starts at. */
/** Every record that heads a facing group. */
export function recordStarts(rom: Uint8Array): Set<number> {
    let set = startsCache.get(rom);
    if (!set) {
        set = new Set();
        for (const g of animationGroups(rom)) for (const sc of g.scripts) set.add(sc);
        startsCache.set(rom, set);
    }
    return set;
}

export function animationGroups(rom: Uint8Array): AnimationGroup[] {
    const groups: AnimationGroup[] = [];
    let r = RECORD_FIRST;
    while (r < RECORD_END) {
        const flags = at(rom, ANIMATION_TABLE + r + 3);
        const facings = flags & DIRECTIONAL_8 ? FACINGS_8 : flags & DIRECTIONAL_4 ? FACINGS_4 : [0];
        const scripts = facings.map((_, i) => recordScript(rom, r + i * RECORD_SIZE));
        groups.push({ record: r, flags, facings, scripts });
        r += facings.length * RECORD_SIZE;
    }
    return groups;
}

/** `$908124`'s four-facing table: facing → byte offset to that facing's record. */
const FACING_TABLE = 0x90815b;

/**
 * The script a record plays at a facing — `$908124`: flags bit 7 adds
 * `2 * facing`, bit 6 adds `$90815B[facing]`, otherwise the record serves all.
 */
export function facingScript(rom: Uint8Array, record: number, facing: number): number {
    if (!record) return 0;
    const flags = at(rom, ANIMATION_TABLE + record + 3);
    let r = record;
    if (flags & DIRECTIONAL_8) r += 2 * facing;
    else if (flags & DIRECTIONAL_4) r += read16At(rom, FACING_TABLE + facing);
    return recordScript(rom, r);
}

/** The record a global animation id selects, or 0 when the id is out of range. */
export function animationIdRecord(rom: Uint8Array, id: number): number {
    if (id < 0 || id >= ANIMATION_ID_COUNT * 2 || (id & 1)) return 0;
    return read16At(rom, ANIMATION_ID_TABLE + id);
}
