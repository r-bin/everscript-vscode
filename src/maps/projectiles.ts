// Ownership: projectile records — what animation command `0x4c` throws, how it
// is drawn, and how a straight-flying one moves. Pure.
//
// `0x4c` (`$908725`) reads a word and three signed bytes, puts the spawn point
// at (x + dx, y + dy, height + dz * 16), and calls `$90DCA4` with the word in
// `$06`. Everything that routine and `$90DC35` read is `$900000 + id`, a
// 24-byte record. docs/script-format/animation_script.md § Projectiles.

import { snesToRom, readByte } from './rom';

const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));
const word = (rom: Uint8Array, snes: number): number => at(rom, snes) | (at(rom, snes + 1) << 8);
const signed16 = (v: number): number => (v << 16) >> 16;

/** Projectile records live in bank $90; the id is the record's address in it. */
export const PROJECTILE_BANK = 0x900000;
export const PROJECTILE_STRIDE = 24;

/** One projectile record. Fields not named here are copied but not understood. */
export interface ProjectileRecord {
    id: number;
    /** +0x00: animation record, started at `$90DC8D` with the thrower's facing. 0 = none. */
    animRecord: number;
    /** +0x02: palette in bank $90 (`$90CD80`); 0 keeps the thrower's palette (`$90DC57`). */
    palette: number;
    /** +0x08: index into the movement-routine table at `$90D967`. */
    routine: number;
    /** +0x0C: copied to entity +0x26. */
    field0c: number;
    /** +0x0E: speed — routines 2 and 4 put it into the velocity, signed by facing. */
    speed: number;
    /** +0x10: copied to entity +0x1E. */
    field10: number;
    /** +0x12: routines 2 and 4 copy it to entity +0x24. */
    field12: number;
    /** +0x14: copied to entity +0x2A. */
    field14: number;
    /** +0x16: power; 0 means derived from the thrower (`$8FC02B`). */
    power: number;
}

export function projectileRecord(rom: Uint8Array, id: number): ProjectileRecord {
    const b = PROJECTILE_BANK | id;
    return {
        id,
        animRecord: word(rom, b),
        palette: word(rom, b + 0x02),
        routine: word(rom, b + 0x08),
        field0c: word(rom, b + 0x0c),
        speed: word(rom, b + 0x0e),
        field10: word(rom, b + 0x10),
        field12: signed16(word(rom, b + 0x12)),
        field14: word(rom, b + 0x14),
        power: word(rom, b + 0x16),
    };
}

/**
 * Routines that fly in a straight line along the facing. `4` is `$90DD61`;
 * `2` (`$90DD58`) sets the power from `$0A3F` and jumps into it.
 */
const STRAIGHT_ROUTINES = new Set([2, 4]);

/**
 * Velocity per facing, from `$90DD61`'s direction table at `$90DD88`: the
 * speed goes into x (+0x20) and y (+0x22) unscaled, so diagonals are faster.
 */
const DIRECTION: Record<number, [number, number]> = {
    0: [0, -1], 2: [1, -1], 4: [1, 0], 6: [1, 1],
    8: [0, 1], 10: [-1, 1], 12: [-1, 0], 14: [-1, -1],
};

/** Positions are kept ×16 (`$90DD61` shifts them left four), so speed is 1/16 px per tick. */
const SUBPIXELS = 16;

/**
 * Pixels per tick for a straight-flying projectile at this facing, or null
 * when its routine is not a straight line (homing, arcing — not modelled).
 */
export function projectileVelocity(p: ProjectileRecord, facing: number): { vx: number; vy: number } | null {
    if (!STRAIGHT_ROUTINES.has(p.routine)) return null;
    const d = DIRECTION[facing & 0x0e];
    return { vx: (d[0] * p.speed) / SUBPIXELS, vy: (d[1] * p.speed) / SUBPIXELS };
}
