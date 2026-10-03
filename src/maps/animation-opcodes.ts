// Ownership: the animation bytecode's instruction set — every opcode's width,
// mnemonic and operand layout — and a disassembler over it. Pure.
//
// The table is read out of the interpreter's dispatch table at $908000 and the
// handlers it points to; docs/script-format/animation_script.md gives the
// handler and the evidence for every row. This is the one place widths live:
// ./character-animation and ./animation-vm both ask `opcode()`.

import { snesToRom, readByte } from './rom';

const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));
const word = (rom: Uint8Array, snes: number): number => at(rom, snes) | (at(rom, snes + 1) << 8);
const signed8 = (v: number): number => (v << 24) >> 24;
const signed16 = (v: number): number => (v << 16) >> 16;
const hex = (v: number, digits: number): string => v.toString(16).padStart(digits, '0');

/** Bit 7 of a command byte: the frame ends after this command. */
export const END_FRAME = 0x80;
export const COMMAND_MASK = 0x7f;

/** What a command does to control flow — the interpreter and disassembler branch on it. */
export type OpKind =
    | 'plain' | 'hold' | 'hold_operand' | 'hold_random' | 'sprite' | 'sprite2' | 'reset'
    | 'loop' | 'restart_here' | 'jump' | 'dec_jnz' | 'jump_pos' | 'jump_if_linked'
    | 'set8' | 'set16' | 'set24' | 'add8' | 'add16' | 'clear'
    | 'strike' | 'step' | 'sprite_long' | 'sprite_aim' | 'projectile'
    | 'hop' | 'hop_maybe' | 'wait_landed' | 'hover_hold' | 'mode' | 'segments' | 'segment' | 'segment_step' | 'hurtbox'
    | 'hud' | 'palette';

export interface Opcode {
    /** Total bytes, opcode included. */
    length: number;
    mnemonic: string;
    kind: OpKind;
}

const op = (length: number, mnemonic: string, kind: OpKind = 'plain'): Opcode => ({ length, mnemonic, kind });

/**
 * Every opcode whose width is fixed. `0x57` (segments) has a width read from
 * its own operand; `lengthAt()` measures it.
 */
const OPCODES: Record<number, Opcode> = {
    0x00: op(1, 'nop'), 0x21: op(1, 'nop'),
    0x1f: op(3, 'hold_random', 'hold_random'),
    0x20: op(2, 'hold', 'hold_operand'),
    0x2c: op(4, 'sprite2', 'sprite2'),
    0x2d: op(1, 'loop', 'loop'),
    0x2e: op(2, 'sound'),
    0x2f: op(2, 'sound_maybe'),
    0x30: op(1, 'restart_here', 'restart_here'),
    0x31: op(3, 'set8', 'set8'),
    0x32: op(4, 'set', 'set16'),
    0x33: op(5, 'set24', 'set24'),
    0x34: op(6, 'poke'),
    0x35: op(3, 'add8', 'add8'),
    0x36: op(4, 'add', 'add16'),
    0x37: op(2, 'clear', 'clear'), 0x38: op(2, 'clear', 'clear'),
    0x39: op(4, 'dec_jnz', 'dec_jnz'),
    0x3a: op(4, 'jump_pos', 'jump_pos'),
    0x3b: op(3, 'jump', 'jump'),
    0x3c: op(9, 'op_3c'),              // four words, then a colour transfer via $90D34C / $8085FA
    0x3d: op(5, 'op_3d'),              // two words, then $90CFB8
    0x3e: op(9, 'op_3e'),              // four words, then $90D408
    0x3f: op(3, 'op_3f'),
    0x40: op(3, 'op_40'),
    0x41: op(1, 'step0'),
    0x42: op(2, 'step', 'step'),
    0x43: op(1, 'wait_landed', 'wait_landed'),
    0x44: op(1, 'hover_hold', 'hover_hold'),   // +1 tick while height >= $0E96 (a random hover height)
    0x45: op(3, 'hop', 'hop'),
    0x46: op(3, 'hop_maybe', 'hop_maybe'),
    0x47: op(5, 'strike', 'strike'),
    0x48: op(1, 'op_48'),
    0x49: op(3, 'op_49'),
    0x4a: op(3, 'op_4a'),
    0x4b: op(3, 'palette', 'palette'),   // $90885A → $90CD5C: load this palette (the loader at $90CD80) into +0x0C
    0x4c: op(6, 'projectile', 'projectile'),
    0x4d: op(3, 'mode', 'mode'),
    0x4e: op(1, 'op_4e'),
    0x4f: op(1, 'op_4f'),
    0x50: op(5, 'hurtbox', 'hurtbox'),
    0x51: op(1, 'op_51'),              // player slot only: $8FB28D
    0x52: op(1, 'reset', 'reset'),
    0x53: op(1, 'end_check'),
    0x54: op(3, 'jump_if_linked', 'jump_if_linked'),
    0x55: op(1, 'op_55'),
    0x56: op(3, 'op_56'),
    0x58: op(1, 'segment_step', 'segment_step'),   // $8FC905: ease every segment one tick; hurt offset = head
    // $8FC8DE: a byte offset into the segment list (+0x86), a byte, a word, and a
    // signed x/y byte pair into that segment's +0x0C/+0x0D — where it sits.
    0x59: op(7, 'segment', 'segment'),
    0x5a: op(2, 'op_5a'),
    0x5b: op(1, 'mark_position'),
    0x5c: op(1, 'op_5c'),
    // HUD commands: sprites drawn straight to fixed screen positions via $809033, picked
    // from an inline table by game state. Not part of the entity; the first entry is what
    // a preview shows.
    0x60: op(49, 'hud_bar', 'hud'),      // $908D79: full segments (entry 0) + one of 16 partials, by an entity ratio
    0x61: op(13, 'hud_column', 'hud'),   // $908C7E: four sprites stacked at x 22, y 92/103/114/125
    0x62: op(28, 'hud_gauge', 'hud'),    // $908CEE: one of 9, by $0B15, at (224, 16)
    0x63: op(13, 'hud_icon', 'hud'),     // $908D2D: one of 4, by $7E2348, at (232, 20) / (96, 162)
    0x64: op(52, 'hud_meter', 'hud'),    // $908E09: one of 17, by $0E45, at (128, 202)
    0x5d: op(1, 'op_5d'),
    0x5e: op(25, 'sprite_aim', 'sprite_aim'),  // eight 24-bit sprites; $919932 picks one by angle
    0x5f: op(4, 'sprite_long', 'sprite_long'), // one 24-bit sprite, drawn at once via $809033
};

const HOLD_FIRST = 0x01;          // $90836C: hold for `cmd` ticks
const HOLD_LAST = 0x1e;
const SPRITE_FIRST = 0x22;        // $908418: bank = cmd + 0xA8
const SPRITE_LAST = 0x2b;
const SPRITE_BANK_BIAS = 0xa8;

/**
 * `0x57`, `$8FCA02`: a segmented body (Tar Skull, Bone Snake). Operand: a total
 * segment count N, then groups of [count K][24-bit sprite] until N segments
 * have one, each written into the 14-byte segment list at entity +0x86.
 */
const SEGMENTS = 0x57;
/** Segment entries in the list at +0x86: the first at +4, every 14 bytes ($8FCA13, $8FCA42). */
export const SEGMENT_FIRST = 4;
export const SEGMENT_STRIDE = 14;
const SEGMENTS_OP: Opcode = { length: 0, mnemonic: 'segments', kind: 'segments' };

export interface SegmentGroup { count: number; sprite: number }

/** The segment groups a `segments` command at `p` lists, and its total width. */
export function segmentsAt(rom: Uint8Array, p: number): { total: number; groups: SegmentGroup[]; length: number } {
    const total = at(rom, p + 1);
    const groups: SegmentGroup[] = [];
    let q = p + 2;
    let assigned = 0;
    while (assigned < total && groups.length < 64) {
        const count = at(rom, q);
        groups.push({ count, sprite: (word(rom, q + 1) | (at(rom, q + 3) << 16)) >>> 0 });
        assigned += count || total;          // a 0 count runs to the end ($8FCA46 wraps)
        q += 4;
    }
    return { total, groups, length: q - p };
}

/** Bytes the command at `p` occupies, or 0 when unknown. */
export function lengthAt(rom: Uint8Array, p: number): number {
    const raw = at(rom, p);
    if ((raw & COMMAND_MASK) === SEGMENTS) return segmentsAt(rom, p).length;
    const o = opcode(raw);
    return o ? o.length : 0;
}

/** The opcode for a command byte (bit 7 ignored), or null when its width is unknown. */
export function opcode(cmd: number): Opcode | null {
    const c = cmd & COMMAND_MASK;
    if (c === SEGMENTS) return SEGMENTS_OP;
    if (c >= HOLD_FIRST && c <= HOLD_LAST) return { length: 1, mnemonic: 'hold', kind: 'hold' };
    if (c >= SPRITE_FIRST && c <= SPRITE_LAST) return { length: 3, mnemonic: 'sprite', kind: 'sprite' };
    return OPCODES[c] ?? null;
}

/** The SNES address a `sprite` command at `p` selects. */
export function spriteOperand(rom: Uint8Array, p: number): number {
    return ((((at(rom, p) & COMMAND_MASK) + SPRITE_BANK_BIAS) << 16) | word(rom, p + 1)) >>> 0;
}

/** The SNES address a `sprite2` command at `p` selects (24-bit operand). */
export function sprite2Operand(rom: Uint8Array, p: number): number {
    return (word(rom, p + 1) | (at(rom, p + 3) << 16)) >>> 0;
}

/** The 24-bit sprite address at `p` (`sprite_long`, and each `sprite_aim` entry). */
export function sprite24At(rom: Uint8Array, p: number): number {
    return (word(rom, p) | (at(rom, p + 2) << 16)) >>> 0;
}

/** The target of a jump-family command at `p`: a u16 in the script's own bank. */
export function jumpTarget(rom: Uint8Array, p: number, kind: OpKind): number {
    const operand = kind === 'jump' || kind === 'jump_if_linked' ? p + 1 : p + 2;
    return ((p & 0xff0000) | word(rom, operand)) >>> 0;
}

/** One disassembled command. */
export interface ScriptLine {
    address: number;
    bytes: number[];
    /** The notation of docs/script-format/animation_script.md, `!` marking a frame end. */
    text: string;
    endFrame: boolean;
    /** False for a command whose width is unknown — the listing stops there. */
    known: boolean;
}

function operands(rom: Uint8Array, p: number, o: Opcode): string {
    const b = (i: number) => at(rom, p + i);
    const w = (i: number) => word(rom, p + i);
    switch (o.kind) {
        case 'hold': return String(at(rom, p) & COMMAND_MASK);
        case 'hold_operand': return String(b(1));
        case 'hold_random': return `${b(1)}, ${b(2)}`;
        case 'sprite': return '$' + hex(spriteOperand(rom, p), 6);
        case 'sprite2': return '$' + hex(sprite2Operand(rom, p), 6);
        case 'set8': case 'add8': return `var[$${hex(b(1), 2)}], ${b(2)}`;
        case 'set16': case 'add16': return `var[$${hex(b(1), 2)}], ${signed16(w(2))}`;
        case 'set24': return `var[$${hex(b(1), 2)}], $${hex(b(2) | (w(3) << 8), 6)}`;
        case 'clear': return `var[$${hex(b(1), 2)}]`;
        case 'dec_jnz': case 'jump_pos': return `var[$${hex(b(1), 2)}], $${hex(jumpTarget(rom, p, o.kind), 6)}`;
        case 'jump': case 'jump_if_linked': return '$' + hex(jumpTarget(rom, p, o.kind), 6);
        case 'strike': return `${signed8(b(1))}, ${signed8(b(2))}, ${b(3)}, ${b(4)}`;
        case 'step': return String(signed8(b(1)));
        case 'hud': {
            const n = (o.length - 1) / 3;
            return `${n} sprite${n === 1 ? '' : 's'}, first $${hex(sprite24At(rom, p + 1), 6)}`;
        }
        case 'segment': return `#${(b(1) - SEGMENT_FIRST) / SEGMENT_STRIDE}, ${signed8(b(5))}, ${signed8(b(6))}`;
        case 'segments': {
            const sg = segmentsAt(rom, p);
            return sg.total + ': ' + sg.groups.map((g) => `${g.count}×$${hex(g.sprite, 6)}`).join(', ');
        }
        case 'sprite_long': return '$' + hex(sprite24At(rom, p + 1), 6);
        case 'sprite_aim': {
            const all: string[] = [];
            for (let i = 0; i < 8; i++) all.push('$' + hex(sprite24At(rom, p + 1 + i * 3), 6));
            return all.join(', ');
        }
        default: break;
    }
    if (o.kind === 'hop' || o.kind === 'hop_maybe') return String(signed16(w(1)));
    if (o.mnemonic === 'mode') return '$' + hex(w(1), 4);
    if (o.kind === 'palette') return '$' + hex(w(1), 4);
    if (o.mnemonic === 'sound' || o.mnemonic === 'sound_maybe') return '$' + hex(b(1), 2);
    if (o.mnemonic === 'hurtbox') return `${signed16(w(1))}, ${signed16(w(3))}`;
    if (o.kind === 'projectile') return `$${hex(w(1), 4)}, ${signed8(b(3))}, ${signed8(b(4))}, ${signed8(b(5))}`;
    const rest: string[] = [];
    for (let i = 1; i < o.length; i++) rest.push(hex(b(i), 2));
    return rest.join(' ');
}

/** Disassemble the single command at `p`. */
export function disassembleAt(rom: Uint8Array, p: number): ScriptLine {
    const raw = at(rom, p);
    const o = opcode(raw);
    const endFrame = (raw & END_FRAME) !== 0;
    if (!o) {
        return { address: p, bytes: [raw], text: `op_${hex(raw & COMMAND_MASK, 2)} ??`, endFrame, known: false };
    }
    const bytes: number[] = [];
    const len = lengthAt(rom, p);
    for (let i = 0; i < len; i++) bytes.push(at(rom, p + i));
    const args = operands(rom, p, o);
    const text = o.mnemonic + (args ? ' ' + args : '') + (endFrame ? '!' : '');
    return { address: p, bytes, text, endFrame, known: true };
}

const MAX_LINES = 512;

/**
 * Every command reachable from `script`, in address order.
 *
 * Follows fall-through and both sides of every branch; a path ends at `loop`,
 * an unconditional `jump`, or a command of unknown width. Nothing past those
 * is listed, because nothing past them is this script.
 */
export function disassembleScript(rom: Uint8Array, script: number): ScriptLine[] {
    const lines = new Map<number, ScriptLine>();
    const work = [script];
    while (work.length && lines.size < MAX_LINES) {
        let p = work.pop() as number;
        while (!lines.has(p) && lines.size < MAX_LINES) {
            const line = disassembleAt(rom, p);
            lines.set(p, line);
            const o = opcode(line.bytes[0]);
            if (!o || o.kind === 'loop') break;
            if (o.kind === 'jump') { p = jumpTarget(rom, p, o.kind); continue; }
            if (o.kind === 'dec_jnz' || o.kind === 'jump_pos' || o.kind === 'jump_if_linked') {
                work.push(jumpTarget(rom, p, o.kind));
            }
            p += line.bytes.length;
        }
    }
    return [...lines.values()].sort((a, b) => a.address - b.address);
}
