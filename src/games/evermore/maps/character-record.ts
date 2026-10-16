// Ownership: the character table at $8EB678 — the fields this project reads
// out of a character record, and the animation record its `anim_stand`
// selects. Pure.
//
// Layout from SoETilesViewer's `characterdata.h`, verified field by field
// against its editor; see docs/script-format/character_table.md. Walking the
// animation a record points at is ./character-animation, and drawing the
// result is ./characters.

import { snesToRom, readByte } from './rom';

/** Byte at a SNES address. */
const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));

export function read16At(rom: Uint8Array, snes: number): number {
    return at(rom, snes) | (at(rom, snes + 1) << 8);
}

/** The character table SoETilesViewer's `characterdata.h` documents. */
export const CHARACTER_TABLE = 0x8eb678;
export const CHARACTER_STRIDE = 74;
const ENTITY_FLAGS = 0x05;
const COLLISION_RADIUS = 0x0d;
const PALETTE = 0x09;
const ANIM_STAND = 0x32;

/**
 * The record's animation pointers, by what they are for.
 *
 * `characterdata.h` names them; the four attack ones are where a character's
 * strike boxes live (see docs/script-format/attack_boxes.md).
 */
export const ANIMATION_FIELDS = {
    stand: 0x32,
    walk: 0x34,
    run: 0x36,
    attack0: 0x38,
    attack1: 0x3a,
    attack2: 0x3c,
    attack3: 0x3e,
    damage: 0x40,
    death: 0x42,
} as const;

export const ATTACK_FIELDS = [
    ANIMATION_FIELDS.attack0, ANIMATION_FIELDS.attack1,
    ANIMATION_FIELDS.attack2, ANIMATION_FIELDS.attack3,
];
const PALETTE_BANK = 0x900000;

export const ANIMATION_TABLE = 0xc40000;

/**
 * Animations can come in a set, one per facing.
 *
 * `$908124` reads the record's flags byte and, when bit 7 is set, indexes a
 * *set* of records instead of using this one:
 *
 *     908124  LDA $C40002,X    ; bank + flags
 *     908128  BMI $908150      ; bit 7 of flags: directional
 *     908150  TXA
 *     908152  ADC $0022,Y      ; + the entity's facing
 *     908155  ADC $0022,Y      ; ... twice, so the stride is 2 per step
 *
 * Entity `+0x22` holds the facing. Spawning writes **8**, and so does the
 * FACE SOUTH opcode, so 8 is both "south" and what an enemy starts as —
 * which is why an unposed enemy already faces the camera.
 */
const DIRECTIONAL_FLAG = 0x80;
/**
 * The other, more common directional form.
 *
 * When bit 6 is set instead, `$90812A` adds a table entry rather than
 * scaling the facing:
 *
 *     90812A  BIT #$4000
 *     90812D  BEQ $908139      ; neither bit: one pose for every direction
 *     908130  LDX $0022,Y      ; the facing
 *     908134  ADC $90815B,X    ; + this table
 *
 * The table maps the sixteen facings onto four records (+0, +4, +8, +12),
 * so these characters have four poses rather than eight. 85 of the 141
 * enemies use this form and only 7 use bit 7 — which is why so many were
 * still drawn in their first pose.
 */
const TABLE_FLAG = 0x40;
const FACING_TABLE = 0x90815b;
export const FACING_SOUTH = 8;

/**
 * The animation record for a character at a given facing.
 *
 * A record is `[scriptLow:u16][bank:u8][flags:u8]`. When the flags say the
 * animation is directional, the facing selects a sibling record; otherwise
 * the same one serves every direction.
 */
export function animationScript(
    rom: Uint8Array,
    character: number,
    facing: number,
    field: number = ANIM_STAND,
): number {
    const record = CHARACTER_TABLE + character * CHARACTER_STRIDE;
    let anim = read16At(rom, record + field);
    if (!anim) return 0;                     // the record has no such animation
    const flags = at(rom, ANIMATION_TABLE + anim + 3);
    if (flags & DIRECTIONAL_FLAG) anim += 2 * facing;
    else if (flags & TABLE_FLAG) anim += read16At(rom, FACING_TABLE + facing);
    return recordScript(rom, anim);
}

/**
 * The script an animation record at `$C40000 + record` points to, taken as
 * it stands — no facing applied. Ring-menu icons use these records too
 * (./item-icons), and none of theirs is directional.
 */
export function recordScript(rom: Uint8Array, record: number): number {
    return (read16At(rom, ANIMATION_TABLE + record) | (at(rom, ANIMATION_TABLE + record + 2) << 16)) >>> 0;
}

/**
 * The 16-bit value in record `+0x09` — a character's palette, as the game
 * identifies it.
 *
 * This is the whole identity: `$90CD80` compares exactly this number against
 * the five palette slots and reuses a slot when it matches, so two characters
 * with the same value never cost two slots. See
 * docs/script-format/palettes.md.
 */
export function characterPaletteAddress(rom: Uint8Array, character: number): number {
    return read16At(rom, CHARACTER_TABLE + character * CHARACTER_STRIDE + PALETTE);
}

/** A character's 16 colours as RGB triples; index 0 is transparent. */
export function characterPalette(rom: Uint8Array, character: number): Array<[number, number, number]> {
    return paletteAt(rom, characterPaletteAddress(rom, character));
}

/**
 * 16 colours at a 16-bit address in the palette bank, as RGB triples; index 0
 * is transparent. Characters name theirs in record `+0x09`; ring-menu icons
 * in their entry's `+4` word (./item-icons) — the same bank either way.
 */
export function paletteAt(rom: Uint8Array, address: number): Array<[number, number, number]> {
    const base = PALETTE_BANK | address;
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < 16; i++) {
        const c = read16At(rom, base + i * 2);
        // BGR555, widened the way the PPU does.
        out.push([(c & 31) * 8, ((c >> 5) & 31) * 8, ((c >> 10) & 31) * 8]);
    }
    return out;
}

/**
 * Whether a character fights back.
 *
 * Record `+0x05` is the character's default entity flags — the same bit
 * field `add_enemy(…, flags)` passes per spawn, which the everscript
 * compiler calls `CHARACTER_FLAG_ENEMY`. Bit 1 is `INVINCIBLE`, set on the
 * characters that are there to be talked to rather than fought: 39 of the
 * table's characters have it, Strongheart among them, while the Mosquito
 * (`0x0400`, phasing) and the Wimpy Flower (`0x0000`) do not.
 *
 * A spawn may override this — `0x3c` and `0xa2` carry their own flags — so
 * this is the character's disposition, not a given placement's.
 */
const FLAG_INVINCIBLE = 0x0002;
const FLAG_INACTIVE = 0x0020;

export interface CharacterDisposition {
    /** The raw `+0x05` word. */
    flags: number;
    /** Clear `INVINCIBLE`: this one is an enemy. */
    hostile: boolean;
    /** `INACTIVE`: placed, but not acting until a script wakes it. */
    inactive: boolean;
}

export function characterDisposition(rom: Uint8Array, character: number): CharacterDisposition {
    const flags = read16At(rom, CHARACTER_TABLE + character * CHARACTER_STRIDE + ENTITY_FLAGS);
    return {
        flags,
        hostile: (flags & FLAG_INVINCIBLE) === 0,
        inactive: (flags & FLAG_INACTIVE) !== 0,
    };
}

/**
 * How much room a character takes up — the body other entities bump into.
 *
 * Record `+0x0D` is a radius in pixels, and `$8FB4AB` is the whole rule:
 *
 *     8FB4AE  LDA $8E000D,X    ; the candidate's radius
 *     8FB4B2  BEQ $8FB4FC      ; zero: no body at all, walk through it
 *     8FB4B5  ADC $16          ; + the mover's radius
 *     8FB4B9  LDA $001C,Y      ; candidate Y - the position being tested
 *     8FB4C5  ASL              ; |dy| * 2
 *     8FB4C6  CMP $18          ; ...must be under the sum
 *     8FB4CA  LDA $001A,Y      ; and |dx|, undoubled, under it too
 *
 * So two entities collide when `|dx| < r1 + r2` **and** `2 * |dy| < r1 + r2`:
 * an axis-aligned box, twice as wide as it is tall — the usual top-down
 * squash. One character's own body is therefore `2r` wide and `r` tall,
 * centred on its position, which is also where its sprite is anchored.
 *
 * See docs/script-format/hitboxes.md for the trace this came from.
 */
const VERTICAL_SQUASH = 2;

export interface CharacterHitbox {
    /** Record `+0x0D`, in pixels. */
    radius: number;
    /** Full width in pixels, `2 * radius`. */
    width: number;
    /** Full height in pixels, `radius` — the vertical axis counts double. */
    height: number;
    /** Radius 0: nothing to bump into. */
    solid: boolean;
}

export function characterHitbox(rom: Uint8Array, character: number): CharacterHitbox {
    const radius = read16At(rom, CHARACTER_TABLE + character * CHARACTER_STRIDE + COLLISION_RADIUS);
    return {
        radius,
        width: radius * 2,
        height: (radius * 2) / VERTICAL_SQUASH,
        solid: radius > 0,
    };
}

/** Whether two entities at these positions overlap, by the game's own test. */
export function entitiesCollide(
    a: { x: number; y: number; radius: number },
    b: { x: number; y: number; radius: number },
): boolean {
    if (!a.radius || !b.radius) return false;
    const sum = a.radius + b.radius;
    return Math.abs(a.x - b.x) < sum && VERTICAL_SQUASH * Math.abs(a.y - b.y) < sum;
}
