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
import { animationScript, read16At, FACING_SOUTH, ATTACK_FIELDS } from './character-record';
import { opcode } from './animation-opcodes';

/** Byte at a SNES address. */
const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));

const SPRITE_BANK_BIAS = 0xa8;
const SET_SPRITE_FIRST = 0x22;
const SET_SPRITE_LAST = 0x2b;

/**
 * `0x2c` fills a **second** sprite slot, usually the shadow.
 *
 * `$908418` (the `0x22`–`0x2b` family) writes the bank to entity `+0x08` and
 * the address to `+0x06`. `$90842F` writes to `+0x09` and `+0x0A` instead —
 * a different pair, so an entity can carry two sprites at once:
 *
 *     90842F  LDA [$5D]        ; a full 24-bit pointer, bank first
 *     908431  STA $0009,Y
 *     908438  LDA [$5D]
 *     90843A  STA $000A,Y
 *
 * What lands there is a shadow: the Hedgadillo's north record is
 * `52 2c c5 17 cc d3 21 2d`, and `$CC17C5` is a black blob. So it is read as
 * a sprite, but only used when the frame sets no main one — otherwise every
 * flying enemy would gain a shadow it never had in this view.
 */
const SET_SPRITE_SECONDARY = 0x2c;

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
 * Total length of each command. The widths now live in ./animation-opcodes,
 * the one table every walker shares; how they were established:
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
 * being given a length that does not exist. `0x3b` is an unconditional
 * jump and is left out for the same reason: stepping over it reads the wrong
 * bytes. Every opcode is listed in docs/script-format/animation_script.md.
 */

const STRIKE = 0x47;
const STRIKE_LENGTH = 5;
const signed8 = (v: number): number => (v << 24) >> 24;

/** One strike an animation declares — command `0x47`. */
export interface StrikeBox {
    /** Offset from the attacker's position, in pixels. */
    dx: number;
    dy: number;
    /** Full extent in pixels. */
    width: number;
    height: number;
}

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

const MAX_COMMANDS = 64;

/** SNES address of the sprite a character stands still as, or null. */
export function resolveCharacterSprite(
    rom: Uint8Array,
    character: number,
    facing = FACING_SOUTH,
): number | null {
    const script = animationScript(rom, character, facing);
    let p = script;
    let secondary: number | null = null;
    for (let i = 0; i < MAX_COMMANDS; i++) {
        const cmd = at(rom, p) & COMMAND_MASK;
        if (cmd >= SET_SPRITE_FIRST && cmd <= SET_SPRITE_LAST) {
            return (((cmd + SPRITE_BANK_BIAS) << 16) | read16At(rom, p + 1)) >>> 0;
        }
        if (cmd === SET_SPRITE_SECONDARY && secondary === null) {
            secondary = (read16At(rom, p + 1) | (at(rom, p + 3) << 16)) >>> 0;
        }
        if (cmd === LOOP) return secondary;  // back to the start: the shadow is all there is
        p += commandLength(cmd);
        if (commandLength(cmd) === 0) return secondary;  // unknown: stop, never guess
    }
    return secondary;
}

/**
 * Bytes this command occupies, or 0 to stop a linear walk: an unknown width,
 * or an unconditional jump, which a linear walk must not step over.
 */
function commandLength(cmd: number): number {
    const o = opcode(cmd);
    return !o || o.kind === 'jump' ? 0 : o.length;
}

/** One frame of an idle animation. */
export interface AnimationFrame {
    /** SNES address of the sprite to draw. */
    sprite: number;
    /** How long to hold it, in 60Hz ticks. */
    ticks: number;
    /** Active strike box declared on this frame, if any. */
    strikeBox?: StrikeBox | null;
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
    return walkAnimationScript(rom, animationScript(rom, character, facing));
}

/** The walk itself, for any script — ring-menu icons run it too (./item-icons). */
export function walkAnimationScript(
    rom: Uint8Array,
    script: number,
): { frames: AnimationFrame[]; complete: boolean } {
    let p = script;
    const frames: AnimationFrame[] = [];
    const seen = new Set<number>();
    let sprite: number | null = null;
    let ticks = ONE_FRAME;
    let currentStrike: StrikeBox | null = null;

    const emit = () => {
        if (sprite === null) return;
        const last = frames[frames.length - 1];
        if (last && last.sprite === sprite && !last.strikeBox && !currentStrike) {
            last.ticks += ticks;
        } else {
            frames.push({ sprite, ticks, strikeBox: currentStrike });
        }
        ticks = ONE_FRAME;                   // the timer resets as it expires
        currentStrike = null;
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
        } else if (cmd === SET_SPRITE_SECONDARY) {
            // Only as a stand-in: a frame that sets a main sprite keeps it.
            if (sprite === null) sprite = (read16At(rom, p + 1) | (at(rom, p + 3) << 16)) >>> 0;
        } else if (cmd >= HOLD_FIRST && cmd <= HOLD_LAST) {
            ticks = cmd;
        } else if (cmd === HOLD_OPERAND) {
            ticks = at(rom, p + 1);
        } else if (cmd === STRIKE) {
            currentStrike = {
                dx: signed8(at(rom, p + 1)),
                dy: signed8(at(rom, p + 2)),
                width: at(rom, p + 3),
                height: at(rom, p + 4),
            };
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
    if (complete && frames.length > 1 && frames[0].sprite === frames[frames.length - 1].sprite && !frames[0].strikeBox && !frames[frames.length - 1].strikeBox) {
        frames[0].ticks += (frames.pop() as AnimationFrame).ticks;
    }
    return { frames, complete };
}


/**
 * Every strike command in one animation script, in script order.
 *
 * `complete` is false when the walk met a command of unknown width and
 * stopped — there may be strikes it never reached.
 */
export function strikeBoxes(
    rom: Uint8Array,
    script: number,
): { boxes: StrikeBox[]; complete: boolean } {
    const boxes: StrikeBox[] = [];
    const seen = new Set<number>();
    let p = script;
    for (let i = 0; i < MAX_COMMANDS * 2; i++) {
        if (seen.has(p)) return { boxes, complete: true };
        seen.add(p);
        const cmd = at(rom, p) & COMMAND_MASK;
        if (cmd === LOOP) return { boxes, complete: true };
        if (cmd === STRIKE) {
            boxes.push({
                dx: signed8(at(rom, p + 1)),
                dy: signed8(at(rom, p + 2)),
                width: at(rom, p + 3),
                height: at(rom, p + 4),
            });
        }
        const length = cmd === STRIKE ? STRIKE_LENGTH : commandLength(cmd);
        if (length === 0) return { boxes, complete: false };
        p += length;
    }
    return { boxes, complete: false };
}

/**
 * The distinct strikes a character's four attack animations declare.
 *
 * A script repeats the same box across the frames it stays out for, and the
 * four attack animations often share one, so identical boxes are collapsed:
 * what is interesting is the reach, not how many frames carry it.
 */
export function characterStrikeBoxes(
    rom: Uint8Array,
    character: number,
    facing = FACING_SOUTH,
): { boxes: StrikeBox[]; complete: boolean } {
    const boxes: StrikeBox[] = [];
    const key = new Set<string>();
    let complete = true;
    for (const field of ATTACK_FIELDS) {
        const script = animationScript(rom, character, facing, field);
        if (!script) continue;
        const walk = strikeBoxes(rom, script);
        if (!walk.complete) complete = false;
        for (const b of walk.boxes) {
            const k = `${b.dx},${b.dy},${b.width},${b.height}`;
            if (key.has(k)) continue;
            key.add(k);
            boxes.push(b);
        }
    }
    return { boxes, complete };
}
