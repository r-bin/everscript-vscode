// Ownership: what a character looks like — its idle sprite, its animation
// and its palette. Pure.
//
// Solved from Mesen traces of spawning a Mosquito and a Wimpy Flower; see
// docs/script-format/animation_format.md for the trace lines each step came
// from. Sprite pixels themselves live in ./sprites.

import { snesToRom, readByte } from './rom';
import { composeSprite, readSpriteInfo } from './sprites';

/** Byte at a SNES address. */
const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));

// Solved from a Mesen trace of spawning a Mosquito; see
// docs/sprite-rendering.md for the trace lines each step came from.
//
//   character record + 0x32   anim_stand, a 16-bit index
//   $C40000 + anim_stand      a 24-bit pointer to an animation script
//   walk that script          the first command in 0x22..0x28 sets the sprite
//   sprite pointer            ((cmd + 0xA8) << 16) | the 16-bit operand
//   character record + 0x09   palette, a 16-bit address within bank $90
//
// The command byte carries the sprite's bank in itself: the interpreter at
// $908418 does `TXA; LSR; ADC #$A8` on the doubled opcode, which is
// `bank = cmd + 0xA8`.

/** The character table SoETilesViewer's `characterdata.h` documents. */
const CHARACTER_TABLE = 0x8eb678;
const CHARACTER_STRIDE = 74;
const ANIM_STAND = 0x32;
const PALETTE = 0x09;
const ANIMATION_TABLE = 0xc40000;
const SPRITE_BANK_BIAS = 0xa8;
const SET_SPRITE_FIRST = 0x22;
const SET_SPRITE_LAST = 0x2b;
const PALETTE_BANK = 0x900000;

/**
 * **Bit 7 of a command means "end of frame", not a different command.**
 *
 * The interpreter's dispatch makes this explicit:
 *
 *     9080F0  LDA [$5D]        ; the command
 *     9080F2  ASL              ; carry = bit 7, A = (cmd & 0x7f) * 2
 *     9080F9  TAX
 *     9080FA  BCC $9080EC      ; bit 7 clear: dispatch and keep going
 *     9080FC  JSR ($8000,X)    ; bit 7 set: dispatch, then...
 *     908100  DEC $0005,X      ; ...tick the entity's frame timer and return
 *
 * Both paths index the same table with `(cmd & 0x7f) * 2`, so `0xa4` is
 * command `0x24` — a set-sprite — that also ends the frame. Reading the high
 * ones as separate opcodes is what made the Wimpy Flower look undecodable.
 */
const COMMAND_MASK = 0x7f;

/**
 * Total length of each command, keyed by its masked opcode.
 *
 * Measured rather than guessed, from the distance `$5D` moves between
 * consecutive reads at `$9080F0`. An opcode that is not listed stops the
 * walk rather than being skipped by a guessed width — the same rule the
 * script decoder follows.
 */
const COMMAND_LENGTH: Record<number, number> = {
    0x00: 1, 0x2c: 4, 0x2e: 2, 0x41: 2, 0x4d: 3,
    0x52: 1, 0x53: 2, 0x54: 3, 0x5a: 2,
};

/**
 * Command classes, read straight out of the dispatch table at `$908000`.
 *
 * Grouping the table's 128 entries by handler address shows the ranges:
 * `$90836C` serves 0x01..0x1e and `$908418` serves 0x22..0x2b, so those are
 * families rather than individual opcodes. That is where the earlier
 * too-narrow set-sprite range (0x22..0x28) came from.
 */
const HOLD_FIRST = 0x01;          // $90836C: hold for `cmd` ticks
const HOLD_LAST = 0x1e;
const HOLD_OPERAND = 0x20;        // $90835A: hold for the next byte's ticks
const HOLD_OPERAND_LENGTH = 2;

const MAX_COMMANDS = 64;

function read16At(rom: Uint8Array, snes: number): number {
    return at(rom, snes) | (at(rom, snes + 1) << 8);
}

function read24At(rom: Uint8Array, snes: number): number {
    return (at(rom, snes) | (at(rom, snes + 1) << 8) | (at(rom, snes + 2) << 16)) >>> 0;
}

/** SNES address of the sprite a character stands still as, or null. */
export function resolveCharacterSprite(rom: Uint8Array, character: number): number | null {
    const record = CHARACTER_TABLE + character * CHARACTER_STRIDE;
    const script = read24At(rom, ANIMATION_TABLE + read16At(rom, record + ANIM_STAND));
    let p = script;
    for (let i = 0; i < MAX_COMMANDS; i++) {
        const cmd = at(rom, p) & COMMAND_MASK;
        if (cmd >= SET_SPRITE_FIRST && cmd <= SET_SPRITE_LAST) {
            return (((cmd + SPRITE_BANK_BIAS) << 16) | read16At(rom, p + 1)) >>> 0;
        }
        p += commandLength(cmd);
        if (commandLength(cmd) === 0) return null;  // unknown: stop, never guess
    }
    return null;
}

/** Bytes this command occupies, or 0 when its width is not known. */
function commandLength(cmd: number): number {
    if (cmd >= HOLD_FIRST && cmd <= HOLD_LAST) return 1;
    if (cmd === HOLD_OPERAND) return HOLD_OPERAND_LENGTH;
    if (cmd >= SET_SPRITE_FIRST && cmd <= SET_SPRITE_LAST) return 3;
    return COMMAND_LENGTH[cmd] ?? 0;
}

/** One frame of an idle animation. */
export interface AnimationFrame {
    /** SNES address of the sprite to draw. */
    sprite: number;
    /** How long to hold it, in 60Hz ticks. */
    ticks: number;
}

const MAX_FRAMES = 32;
const DEFAULT_HOLD = 8;

/**
 * A character's default (standing) animation.
 *
 * Bit 7 of a command ends the frame, so a frame is emitted whenever a
 * bit-7 command is stepped over — carrying whichever sprite and hold
 * duration are current. The walk stops when it revisits an address, which
 * is how a looping script terminates.
 *
 * A walk that meets a command of unknown width returns the frames it had
 * already observed, with `complete: false`. Those frames are real — each was
 * emitted at a bit-7 boundary with a known sprite and hold — but the cycle
 * may be cut short, so a caller can choose to show only the first frame.
 * Nothing is invented either way.
 */
export function characterAnimation(
    rom: Uint8Array,
    character: number,
): { frames: AnimationFrame[]; complete: boolean } {
    const record = CHARACTER_TABLE + character * CHARACTER_STRIDE;
    let p = read24At(rom, ANIMATION_TABLE + read16At(rom, record + ANIM_STAND));
    const frames: AnimationFrame[] = [];
    const seen = new Set<number>();
    let sprite: number | null = null;
    let ticks = DEFAULT_HOLD;

    let complete = false;
    for (let i = 0; i < MAX_COMMANDS * 2; i++) {
        if (seen.has(p)) { complete = true; break; }   // looped: it repeats
        seen.add(p);
        const raw = at(rom, p);
        const cmd = raw & COMMAND_MASK;
        if (cmd >= SET_SPRITE_FIRST && cmd <= SET_SPRITE_LAST) {
            sprite = (((cmd + SPRITE_BANK_BIAS) << 16) | read16At(rom, p + 1)) >>> 0;
        } else if (cmd >= HOLD_FIRST && cmd <= HOLD_LAST) {
            ticks = cmd;
        } else if (cmd === HOLD_OPERAND) {
            ticks = at(rom, p + 1);
        }
        const length = commandLength(cmd);
        if (length === 0) break;             // unknown width: stop, keep what we have
        p += length;
        if ((raw & 0x80) !== 0 && sprite !== null) {
            frames.push({ sprite, ticks });
            if (frames.length >= MAX_FRAMES) break;
        }
    }
    return { frames, complete };
}

/** A character's 16 colours as RGB triples; index 0 is transparent. */
export function characterPalette(rom: Uint8Array, character: number): Array<[number, number, number]> {
    const base = PALETTE_BANK | read16At(rom, CHARACTER_TABLE + character * CHARACTER_STRIDE + PALETTE);
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < 16; i++) {
        const c = read16At(rom, base + i * 2);
        // BGR555, widened the way the PPU does.
        out.push([(c & 31) * 8, ((c >> 5) & 31) * 8, ((c >> 10) & 31) * 8]);
    }
    return out;
}

/** One sprite as RGBA in a character's palette. */
export function renderSpriteAt(
    rom: Uint8Array,
    pointer: number,
    colours: Array<[number, number, number]>,
): { width: number; height: number; data: Uint8Array } | null {
    const px = composeSprite(rom, readSpriteInfo(rom, pointer));
    if (px.width <= 0 || px.height <= 0) return null;
    const data = new Uint8Array(px.width * px.height * 4);
    for (let i = 0; i < px.pixels.length; i++) {
        const v = px.pixels[i];
        if (v <= 0) continue;                 // -1 unset, 0 transparent
        const [r, g, b] = colours[v];
        data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
    }
    return { width: px.width, height: px.height, data };
}

/** A character's idle sprite as RGBA, or null when its script cannot be walked. */
export function renderCharacterSprite(
    rom: Uint8Array,
    character: number,
): { width: number; height: number; data: Uint8Array } | null {
    const pointer = resolveCharacterSprite(rom, character);
    if (pointer === null) return null;
    return renderSpriteAt(rom, pointer, characterPalette(rom, character));
}
