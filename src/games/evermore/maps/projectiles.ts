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

/** The unit step for a facing: the direction table every mover in the game shares. */
export function facingVector(facing: number): [number, number] {
    return DIRECTION[facing & 0x0e];
}

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

// ── Flight ──────────────────────────────────────────────────────────────────
//
// A projectile is an entity of its own, run every tick by `$90DE5E`, which walks
// the pool `$6387..$64E7` and dispatches on entity +0x26 (record +0x0C) through
// the same table at `$90D967` that record +0x08 used to set it up.

/** Behaviours (record +0x0C) and what each does per tick. */
const FALLING = 0x0e;    // $90DE9C: z-speed -1, height += z-speed, gone below 0; move
const TIMED = 0x12;      // $90DE88: lifetime -1, gone below 0; height fixed; move
const TIMED_OWN_PLANE = 0x1a;  // $90DE80: as 0x12, on the thrower's plane
const ORBIT = 0x10;      // $90DF44: lifetime -1; angle +1; on an ellipse round a centre

/** Setup routines (record +0x08). */
const AIM_BY_TIME = 0x16;    // $90DDCA: velocity = distance / speed, toward the target
const AIM_BY_SPEED = 0x18;   // $90DE11: speed along the direction to the target
const LOOP_OUT = 6;          // $90DEF7: ellipse whose start is the thrower's side

/** The orbit's two tables, 256 words each; `$8088A3` is `$808923` a quarter turn on. */
const ORBIT_X_TABLE = 0x808923;
const ORBIT_Y_TABLE = 0x8088a3;
const ORBIT_LIFETIME = 0x100;   // $90DF0B: one full turn
const MAX_FLIGHT_TICKS = 600;

/** The 16×16 box `$90DED5` hands the hit test every tick the projectile lives. */
export const PROJECTILE_HIT_SIZE = 16;

export type FlightModel = 'straight' | 'aimed' | 'orbit' | 'unknown';

export interface Flight {
    model: FlightModel;
    /** One entry per tick alive: [x px, y px, height in 1/16 px], from the thrower's start. */
    path: Array<[number, number, number]>;
    /** Why the path ends. */
    ends: 'ground' | 'lifetime' | 'cap' | 'unknown';
}

const word16 = (rom: Uint8Array, snes: number): number => signed16(word(rom, snes));

/**
 * Where a projectile goes, tick by tick. `start` is the spawn point (px, and
 * height in 1/16 px); `target` is where the aimed routines aim, null to aim
 * straight ahead. `$80AEAC`/`$80B01D` (aim by speed) quantise the angle; this
 * uses the exact direction instead.
 */
export function projectileFlight(
    rom: Uint8Array,
    p: ProjectileRecord,
    start: { x: number; y: number; z: number },
    facing: number,
    target: { x: number; y: number } | null,
): Flight {
    let x16 = start.x * SUBPIXELS;
    let y16 = start.y * SUBPIXELS;
    let z = start.z;
    let zSpeed = p.field12;            // +0x24, set by routines 2, 4, 0x16, 0x18
    let lifetime = p.field10;          // +0x1E, $90DCA9
    let vx = 0;
    let vy = 0;
    let model: FlightModel = 'unknown';
    let angle = 0;
    let cx = 0;
    let cy = 0;
    const d = DIRECTION[facing & 0x0e];
    const aimAt = target ?? { x: start.x + d[0] * 64, y: start.y + d[1] * 64 };

    if (STRAIGHT_ROUTINES.has(p.routine)) {
        vx = d[0] * p.speed;
        vy = d[1] * p.speed;
        model = 'straight';
    } else if (p.routine === AIM_BY_TIME) {
        // $90DFDF: speed clamped to 4..$3FF, /4, divides 4 × distance.
        const div = Math.max(4, Math.min(0x3ff, p.speed)) >> 2;
        vx = Math.trunc(((aimAt.x - start.x) * 4) / div);
        vy = Math.trunc(((aimAt.y - start.y) * 4) / div);
        model = 'aimed';
    } else if (p.routine === AIM_BY_SPEED) {
        const dx = aimAt.x - start.x;
        const dy = aimAt.y - start.y;
        const len = Math.hypot(dx, dy) || 1;
        vx = Math.round((dx / len) * p.speed);
        vy = Math.round((dy / len) * p.speed);
        model = 'aimed';
    } else if (p.routine === LOOP_OUT) {
        // $90DF11: start at angle (facing ^ 8) × 16, so the centre lies ahead.
        angle = ((facing ^ 8) << 4) & 0xff;
        cx = x16 - word16(rom, ORBIT_X_TABLE + angle * 2) * 8;
        cy = y16 - word16(rom, ORBIT_Y_TABLE + angle * 2) * 4;
        lifetime = ORBIT_LIFETIME;
        model = 'orbit';
    }

    const path: Array<[number, number, number]> = [];
    const px = (v: number) => Math.floor(v / SUBPIXELS);
    if (model === 'unknown') return { model, path, ends: 'unknown' };
    const behaviour = p.field0c;
    if (behaviour !== FALLING && behaviour !== TIMED && behaviour !== TIMED_OWN_PLANE && behaviour !== ORBIT) {
        return { model: 'unknown', path, ends: 'unknown' };
    }

    for (let t = 0; t < MAX_FLIGHT_TICKS; t++) {
        if (behaviour === FALLING) {
            zSpeed -= 1;
            z += zSpeed;
            if (z < 0) return { model, path, ends: 'ground' };
        } else {
            lifetime -= 1;
            if (lifetime < 0) return { model, path, ends: 'lifetime' };
        }
        if (behaviour === ORBIT) {
            angle = (angle + 1) & 0xff;
            x16 = cx + word16(rom, ORBIT_X_TABLE + angle * 2) * 8;
            y16 = cy + word16(rom, ORBIT_Y_TABLE + angle * 2) * 4;
        } else {
            x16 += vx;
            y16 += vy;
        }
        path.push([px(x16), px(y16), z]);
    }
    return { model, path, ends: 'cap' };
}
