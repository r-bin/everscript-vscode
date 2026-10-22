// Ownership: the character record — what the game reads from it when it creates, animates, colours
// and collides an entity — and the animation and palette tables those reads lead to. Pure.
//
// Read from the game's own code (knowledge rom/8eb678.md has the field map and its evidence):
//   records   bank $8E, addressed by the ENEMY table $8E:B55A; in vanilla they follow it,
//             74 bytes apart from $8E:B678. The new entity keeps the address at +$60 ($8F:B094).
//   +$05      OR'd into the entity's flags +$10 ($8F:B0C3): bit 1 = contact runs nothing
//             ($8F:B564), bit 5 = left out of targeting ($8F:D8D2, $8C:F184)
//   +$09/+$0B its palettes: 16-bit addresses in bank $90 ($90:CD1B / $90:CD01 → $90:CF3A)
//   +$0D      its radius: the overlap test $8F:B4AB
//   +$32...   animation ids, chosen by $90:8240-$90:8317 and started by $90:8124 through the
//             4-byte records at $C4:0000

import { busU8, busU16 } from '../../../platform/snes/hirom';
import { bgr555 } from '../../../platform/snes/tiles';
import { ANIMATION_TABLE, facingScript, animationGroups } from './animation-table';
import { walkScriptCommands } from './animation-opcodes';
import { getPaletteBankSnes } from '../variant-resolver';

/** A 16-bit little-endian value at a bus address. */
export function read16At(rom: Uint8Array, snes: number): number {
    return busU16(rom, snes);
}

/** The first record in the record bank ($8E:B678, right after the ENEMY table). */
export const CHARACTER_TABLE = 0x8eb678;
/** Records are this many bytes apart (the ENEMY table's addresses step by it). */
export const CHARACTER_STRIDE = 74;

/**
 * The animation ids in a record, by what the game plays them for ($90:8240-$90:8317): `stand` when
 * nothing moves (also at spawn, $8F:B463), `walk` when it moves, `run` when running ($2262 bit 1),
 * `attack0`-`attack3` by the charge at entity +$2E (below $400, $800, $C00, above), `damage`
 * ($8F:C2C4) and `death`.
 */
export const ANIMATION_FIELDS = {
    stand: 0x32, walk: 0x34, run: 0x36,
    attack0: 0x38, attack1: 0x3a, attack2: 0x3c, attack3: 0x3e,
    damage: 0x40, death: 0x42,
} as const;
export const ATTACK_FIELDS = [ANIMATION_FIELDS.attack0, ANIMATION_FIELDS.attack1, ANIMATION_FIELDS.attack2, ANIMATION_FIELDS.attack3];

export { ANIMATION_TABLE };
/** Entity +$22 when it faces south (script opcode 0x75 writes 8). */
export const FACING_SOUTH = 8;

const PALETTE_BANK = 0x900000;
const FLAGS = 0x05, PALETTE = 0x09, RADIUS = 0x0d;
/** Entity flag bits the record seeds. */
const NO_CONTACT = 0x0002;
const UNTARGETED = 0x0020;

const recordAt = (character: number): number => CHARACTER_TABLE + character * CHARACTER_STRIDE;

/**
 * Word fields read from a record by its address (an entity keeps the low word at +$60, bank $8E):
 * +$00 the name's text pointer ($8C:89FD), +$05 flags, +$09 palette, +$0D radius, +$0F the HP the
 * entity starts with ($8F:B15B copies it into entity +$2A).
 */
export const RECORD_FIELDS = { name: 0x00, flags: FLAGS, palette: PALETTE, radius: RADIUS, hp: 0x0f } as const;

/** A word of the record an entity's +$60 points at. */
export function entityRecordWord(rom: Uint8Array, record: number, field: number): number {
    return read16At(rom, 0x8e0000 | ((record + field) & 0xffff));
}

/** The character index of the record an entity's +$60 points at, or -1 outside the records at $8E:B678. */
export function entityCharacter(record: number): number {
    const at = (0x8e0000 | record) - CHARACTER_TABLE;
    return at >= 0 && at % CHARACTER_STRIDE === 0 && at / CHARACTER_STRIDE < 142 ? at / CHARACTER_STRIDE : -1;
}

/** Record +$00: the 24-bit address of the character's name ($8C:89FD prints it). */
export function entityNamePointer(rom: Uint8Array, record: number): number {
    return (entityRecordWord(rom, record, RECORD_FIELDS.name) | (busU8(rom, 0x8e0000 | ((record + 2) & 0xffff)) << 16)) >>> 0;
}

/** The script a character plays for one of its animations at a facing ($90:8124). */
export function animationScript(rom: Uint8Array, character: number, facing: number, field: number = ANIMATION_FIELDS.stand): number {
    return facingScript(rom, read16At(rom, recordAt(character) + field), facing);
}

/**
 * Record +$09: the address of the character's palette in bank $90. `$90:CD80` compares it with the
 * slots' addresses and reuses a slot that already holds it.
 */
export function characterPaletteAddress(rom: Uint8Array, character: number): number {
    return read16At(rom, recordAt(character) + PALETTE);
}

/** A character's 16 colours as RGB; index 0 is transparent. */
export function characterPalette(rom: Uint8Array, character: number): Array<[number, number, number]> {
    return paletteAt(rom, characterPaletteAddress(rom, character));
}

/** 16 BGR555 colours at `address` in bank $90, as RGB. `$90:CF3A` loads words 1-15; 0 is transparent. */
export function paletteAt(rom: Uint8Array, address: number): Array<[number, number, number]> {
    const bank = getPaletteBankSnes(rom);
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < 16; i++) out.push(i === 0 ? [0, 0, 0] : bgr555(read16At(rom, bank | ((address + 2 * i) & 0xffff))));
    return out;
}

export interface CharacterDisposition {
    /** The raw +$05 word. */
    flags: number;
    /** Bit 1 clear: touching it runs its contact handler (record +$30), as for an enemy. */
    hostile: boolean;
    /** Bit 5: left out of targeting until a script changes it. */
    inactive: boolean;
}

export function characterDisposition(rom: Uint8Array, character: number): CharacterDisposition {
    const flags = read16At(rom, recordAt(character) + FLAGS);
    return { flags, hostile: !(flags & NO_CONTACT), inactive: (flags & UNTARGETED) !== 0 };
}

export interface CharacterHitbox {
    /** Record +$0D, in pixels. */
    radius: number;
    /** Full width in pixels, `2 * radius`. */
    width: number;
    /** Full height in pixels, `radius`: the test counts vertical distance double. */
    height: number;
    /** Radius 0: the overlap test skips it. */
    solid: boolean;
}

export function characterHitbox(rom: Uint8Array, character: number): CharacterHitbox {
    const radius = read16At(rom, recordAt(character) + RADIUS);
    return { radius, width: 2 * radius, height: radius, solid: radius !== 0 };
}

/**
 * Whether two entities overlap, by `$8F:B4AB`: with s = the two radii added, |dx| < s and
 * 2·|dy| < s. An entity of radius 0 takes no part. (The game also requires their heights within
 * $230 and compatible layers.)
 */
export function entitiesCollide(a: { x: number; y: number; radius: number }, b: { x: number; y: number; radius: number }): boolean {
    if (!a.radius || !b.radius) return false;
    const s = a.radius + b.radius;
    return Math.abs(a.x - b.x) < s && 2 * Math.abs(a.y - b.y) < s;
}

const PALETTE_OP = 0x4b;
const palettesCache = new WeakMap<Uint8Array, number[]>();

/**
 * Every palette address referenced in the ROM — by animation scripts (0x4B palette commands)
 * and character records (+0x09 and +0x0B fields) — sorted ascending by 16-bit address in bank $90.
 */
export function paletteAddresses(rom: Uint8Array): number[] {
    const cached = palettesCache.get(rom);
    if (cached) return cached;
    const found = new Set<number>();

    // 1. Palettes referenced by animation scripts
    const seenScripts = new Set<number>();
    for (const g of animationGroups(rom)) {
        for (const script of g.scripts) {
            if (!script || seenScripts.has(script)) continue;
            seenScripts.add(script);
            walkScriptCommands(rom, script, (p, raw) => {
                if ((raw & 0x7f) === PALETTE_OP) {
                    const addr = read16At(rom, p + 1) & 0xffff;
                    if (addr) found.add(addr);
                }
            });
        }
    }

    // 2. Character record palettes (+0x09 and +0x0B)
    for (let c = 0; c < 142; c++) {
        const pal1 = characterPaletteAddress(rom, c) & 0xffff;
        if (pal1) found.add(pal1);
        const pal2 = read16At(rom, recordAt(c) + 0x0b) & 0xffff;
        if (pal2) found.add(pal2);
    }

    const out = [...found].sort((a, b) => a - b);
    palettesCache.set(rom, out);
    return out;
}
