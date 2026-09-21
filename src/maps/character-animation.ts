// Ownership: walking a character's animation script — which sprites its idle
// shows and for how long. Pure.
//
// Solved from Mesen traces of spawning a Mosquito, a Wimpy Flower and a
// Lizard, plus the interpreter's own handlers where no trace runs a command.
// docs/script-format/animation_format.md carries the trace lines each step
// came from.
//
//   character record + 0x32   anim_stand, a 16-bit index
//   $C40000 + anim_stand      a 24-bit pointer to an animation script
//   walk that script          a command in 0x22..0x2b sets the sprite
//   sprite pointer            ((cmd + 0xA8) << 16) | the 16-bit operand
//
// The command byte carries the sprite's bank in itself: the interpreter at
// $908418 does `TXA; LSR; ADC #$A8` on the doubled opcode, which is
// `bank = cmd + 0xA8`.

import { snesToRom, readByte } from './rom';
import { animationScript, read16At, FACING_SOUTH } from './character-record';

/** Byte at a SNES address. */
const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));

const SPRITE_BANK_BIAS = 0xa8;
const SET_SPRITE_FIRST = 0x22;
const SET_SPRITE_LAST = 0x2b;

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
const END_FRAME = 0x80;

/**
 * Total length of each command, keyed by its masked opcode.
 *
 * Measured from the traces, but no longer by pairing consecutive reads —
 * that method has to throw away every pair that crosses a frame boundary,
 * and the survivors gave `0x53` a width of 2 that the game does not use.
 *
 * The interpreter states the answer directly instead. A command is read at
 * `$9080E3` or `$9080F0`, whose trace line prints the **effective address**;
 * when the command ends the frame, `$90810F LDA $5D` prints where execution
 * resumes. So one command's length is the gap between two printed addresses
 * within a single call, and a frame-ending command's is the gap to the saved
 * pointer. No pair has to be discarded and none is contaminated by another
 * entity, because a call serves one entity from start to end.
 *
 * That gives 29 opcodes, each with exactly **one** observed width. Where a
 * handler was also read out of the ROM it agrees — `$90835A` reads one
 * operand byte and does `INC $5D` (2), `$90836C` reads none (1).
 *
 * An opcode not listed here stops the walk rather than being skipped by a
 * guess.
 *
 * Five of these widths come from the handler, not from a trace. `0x44`,
 * `0x45`, `0x46`, `0x50` and `0x5a` are what the last enemies stopped on,
 * and no trace so far runs them. They do not have to be guessed: the
 * interpreter advances `$5D` by one for the opcode and each handler advances
 * it for its own operands, in plain sight.
 *
 *     $908447  0x5a: LDA [$5D]; STA $0082,Y; INC $5D                  -> 2
 *     $9086D4  0x44: compares $001E,Y, bumps the frame timer, RTS     -> 1
 *     $9086E5  0x45: reads a word, then LDX $5D; INX; INX             -> 3
 *     $9086FE  0x46: two paths, both reaching LDX $5D; INX; INX       -> 3
 *     $9085A8  0x50: LDA [$5D] twice, 16-bit, INX INX after each      -> 5
 *
 * Every path through each handler was followed to its `RTS`, and all of them
 * land on the same advance — none is conditional. `0x5a` is the check on
 * this: the trace measured it at 2 as well.
 *
 * Three commands do not advance linearly at all. `0x2d` restarts the script.
 * `0x53` restarts it too when the entity is in state `$0100`
 * (`$9083C7 BNE $90840D`); the other 157 times it was traced, it fell
 * through as one byte, which is what an idle walk sees. And `0x57` is
 * genuinely variable: it calls `$8FCA02`, which walks a list of its own
 * through `$5D` and writes back wherever it stopped (`$8FCA4D STY $5D`).
 * Only the two segmented bosses use it, and they stop the walk rather than
 * being given a length that does not exist.
 */
const COMMAND_LENGTH: Record<number, number> = {
    0x00: 1, 0x1f: 3, 0x21: 1, 0x2c: 4, 0x2e: 2,
    0x41: 1, 0x42: 2, 0x44: 1, 0x45: 3, 0x46: 3, 0x47: 5,
    0x4d: 3, 0x4e: 1, 0x4f: 1, 0x50: 5, 0x52: 1, 0x53: 1,
    0x54: 3, 0x5a: 2,
};

/**
 * `0x2d` restarts the script — it is where an animation loops.
 *
 * Its handler is five instructions and says so outright:
 *
 *     90877D  REP #$20
 *     90877F  LDA $0003,Y     ; the script's start, saved when it was chosen
 *     908782  STA $0000,Y     ; ... becomes the running pointer again
 *     908785  STA $5D
 *     908789  RTS
 *
 * So a walk that reaches `0x2d` has seen the whole cycle. Reading past it
 * runs into whatever script was assembled next, which is what made the Wimpy
 * Flower — whose idle is one held frame followed by `0x2d` — play two frames
 * of its attack.
 */
const LOOP = 0x2d;

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

/** SNES address of the sprite a character stands still as, or null. */
export function resolveCharacterSprite(
    rom: Uint8Array,
    character: number,
    facing = FACING_SOUTH,
): number | null {
    const script = animationScript(rom, character, facing);
    let p = script;
    for (let i = 0; i < MAX_COMMANDS; i++) {
        const cmd = at(rom, p) & COMMAND_MASK;
        if (cmd >= SET_SPRITE_FIRST && cmd <= SET_SPRITE_LAST) {
            return (((cmd + SPRITE_BANK_BIAS) << 16) | read16At(rom, p + 1)) >>> 0;
        }
        if (cmd === LOOP) return null;       // back to the start: nothing more to see
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

/**
 * How long a frame lasts when no hold command says otherwise.
 *
 * The frame timer is entity `+0x05`. It is set to 1 when an animation is
 * chosen (`$908192`), and the frame-end path resets it to 1 every time it
 * reaches zero (`$908108`). So a bit-7 command with no hold before it shows
 * its sprite for exactly one game frame.
 */
const ONE_FRAME = 1;

/**
 * A character's default (standing) animation.
 *
 * Bit 7 ends a frame, and what happens next is the part that matters:
 *
 *     908100  DEC $0005,X      ; the frame timer
 *     908103  BEQ $908108      ; still counting? then...
 *     908107  RTL              ; ...leave the saved pointer where it was
 *     908108  LDA #$01
 *     90810A  STA $0005,X      ; expired: back to one
 *     90810F  LDA $5D
 *     908111  STA $0000,X      ; ...and only now step past the command
 *
 * So the sprite is redrawn from the same point for as many frames as the
 * timer holds, and a hold command is what loads that timer (`$90836C` stores
 * the opcode itself into `+0x05`, `$90835A` stores its operand). A frame
 * therefore lasts whatever the timer holds *at that moment* — one frame by
 * default, not the last hold seen.
 *
 * Frames that repeat a sprite are merged, including across the loop point,
 * because a script can end a frame several times without changing what is on
 * screen. The Wimpy Flower does exactly that, and merging is what makes it
 * the still image it is in the game rather than a three-frame flicker.
 *
 * A walk that meets a command of unknown width returns the frames it had
 * already observed, with `complete: false`. Those are real, but the cycle may
 * be cut short. Nothing is invented either way.
 */
export function characterAnimation(
    rom: Uint8Array,
    character: number,
    facing = FACING_SOUTH,
): { frames: AnimationFrame[]; complete: boolean } {
    let p = animationScript(rom, character, facing);
    const frames: AnimationFrame[] = [];
    const seen = new Set<number>();
    let sprite: number | null = null;
    let ticks = ONE_FRAME;

    const emit = () => {
        if (sprite === null) return;
        const last = frames[frames.length - 1];
        if (last && last.sprite === sprite) last.ticks += ticks;
        else frames.push({ sprite, ticks });
        ticks = ONE_FRAME;                   // the timer resets as it expires
    };

    let complete = false;
    for (let i = 0; i < MAX_COMMANDS * 2; i++) {
        if (seen.has(p)) { complete = true; break; }   // looped: it repeats
        seen.add(p);
        const raw = at(rom, p);
        const cmd = raw & COMMAND_MASK;
        if (cmd === LOOP) {                            // the script's own loop
            if ((raw & END_FRAME) !== 0) emit();
            complete = true;
            break;
        }
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
        if ((raw & END_FRAME) !== 0) {
            emit();
            if (frames.length >= MAX_FRAMES) break;
        }
    }
    // A cycle's last frame runs straight into its first.
    if (complete && frames.length > 1 && frames[0].sprite === frames[frames.length - 1].sprite) {
        frames[0].ticks += (frames.pop() as AnimationFrame).ticks;
    }
    return { frames, complete };
}
