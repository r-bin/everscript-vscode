// Ownership: whether a strike box reaches a target — the geometry and height
// rules of the hit test at `$8FB5F2`. Pure. docs/script-format/attack_boxes.md.
//
//   8FB5F4  LDA #$0280 / SBC $4A / STA $4A     ; $4A = $280 - attack height
//   8FB63D  LDA $001C,Y / ADC #$10 / ADC $0044,Y / SBC $48   ; target y + 16 + hurt y - strike y
//           |..| - radius (+0x0D), ×2, must be < strike height ($40)
//   8FB65A  the same in x with +0x42 against the strike width ($3E)
//   8FB674  LDA $001E,Y / ADC $4A / CMP #$0460 / BCS miss    ; heights
//
// So the target's hurt region is a box of half-size `radius` centred on its
// feet (+0x44 rests at -16, cancelling the +16), and the strike reaches it
// when the two boxes overlap. Height is a separate axis: the target may be at
// most 40 px below the attack and less than 30 px above it.

/** Height is kept in 1/16 px. */
const HEIGHT_UNITS = 16;
const HEIGHT_BIAS = 0x280;
const HEIGHT_SPAN = 0x460;

/** A target taller than this above the attack (1/16 px) cannot be hit: 30 px. */
export const OUT_OF_REACH_ABOVE = HEIGHT_SPAN - HEIGHT_BIAS;
/** ...nor one further than this below it: 40 px. */
export const OUT_OF_REACH_BELOW = HEIGHT_BIAS;

export interface StrikeArea {
    /** Centre, px. */
    x: number;
    y: number;
    width: number;
    height: number;
    /** Height of the attack, 1/16 px. */
    z: number;
}

export interface HurtTarget {
    /** Feet, px. */
    x: number;
    y: number;
    /** Height, 1/16 px. */
    z: number;
    /** Character record +0x0D. */
    radius: number;
}

/** The height rule alone: can an attack at `attackZ` touch something at `targetZ`? */
export function heightsMeet(attackZ: number, targetZ: number): boolean {
    const v = (targetZ + HEIGHT_BIAS - attackZ) & 0xffff;
    return v < HEIGHT_SPAN;
}

/** The whole test: both axes, then height. Planes are assumed to match. */
export function strikeHits(s: StrikeArea, t: HurtTarget): boolean {
    const dy = 2 * (Math.abs(t.y - s.y) - t.radius);
    if (dy >= s.height) return false;
    const dx = 2 * (Math.abs(t.x - s.x) - t.radius);
    if (dx >= s.width) return false;
    return heightsMeet(s.z, t.z);
}

/** Pixels, for labels. */
export const heightPx = (z: number): number => z / HEIGHT_UNITS;

// ── Contact damage ──────────────────────────────────────────────────────────
//
// A mover whose step is blocked by another body (`$8FB4AB`: both radii summed,
// `2|dy| < r1 + r2`, `|dx| < r1 + r2`, heights within `$230`) calls `$8FB52C`, which
// deals damage through the mover's attack proc when the mover is charging (mode
// +0x16 & `$C000`) with full stamina (+0x2E ≥ `$400`) — then empties its stamina
// (`STZ $002E,X`), so one contact hit per charge. A target in knockback or casting
// (mode & `$21`) is skipped, unlike for strikes.

/** Mode bits that make a moving body deal contact damage. */
export const MODE_CONTACT = 0xc000;
const BODY_HEIGHT_SPAN = 0x230;

export interface Body { x: number; y: number; z: number; radius: number }

/** Do two bodies block each other ($8FB4AB)? */
export function bodiesTouch(a: Body, b: Body): boolean {
    const s = a.radius + b.radius;
    if (!a.radius || !b.radius) return false;
    if (2 * Math.abs(a.y - b.y) >= s) return false;
    if (Math.abs(a.x - b.x) >= s) return false;
    return Math.abs(a.z - b.z) < BODY_HEIGHT_SPAN;
}
