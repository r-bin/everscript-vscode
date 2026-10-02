// Ownership: running an animation script tick by tick the way the engine
// does, and the ROM's own catalogue of animations — the record table and the
// global id table. Pure.
//
// The machine is docs/script-format/animation_script.md § The machine:
// commands run until one with bit 7 set; a hold loads the frame timer *and*
// saves the resume pointer after itself, so later ticks of the same frame
// restart there. Running it — rather than reading it linearly as
// ./character-animation does — is what makes counted loops repeat, jumps land,
// and `step` count every tick of a hold.

import { snesToRom, readByte } from './rom';
import { read16At, ANIMATION_TABLE } from './character-record';
import { opcode, spriteOperand, sprite2Operand, sprite24At, jumpTarget, END_FRAME } from './animation-opcodes';

const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));
const signed8 = (v: number): number => (v << 24) >> 24;

/**
 * The animation records: `$C40000 + record`, 4 bytes each, from `$C43E3A` to
 * `$C45999`. Every character and weapon field, and every global id, points
 * at a record inside this range and at the head of a facing group.
 */
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

function recordScript(rom: Uint8Array, record: number): number {
    return (read16At(rom, ANIMATION_TABLE + record) | (at(rom, ANIMATION_TABLE + record + 2) << 16)) >>> 0;
}

/** Every animation in the record table, in record order. */
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

/** One strike box, centred at (dx, dy) from the feet. */
export interface VmStrike { dx: number; dy: number; width: number; height: number }

/** A `projectile` command that ran: what it throws and where, relative to the feet. */
export interface VmSpawn {
    /** Projectile record id (`$900000 + id`, ./projectiles). */
    id: number;
    dx: number;
    dy: number;
    /** Height offset, in the same units as dx/dy (the handler stores it ×16). */
    dz: number;
    /** Ticks into its frame when it spawned. */
    at: number;
}

/** One displayed frame: consecutive ticks that look the same. */
export interface VmFrame {
    /** Main sprite, or null while the script draws nothing. */
    sprite: number | null;
    /** Second sprite slot (usually the shadow). */
    sprite2: number | null;
    ticks: number;
    strikeBox: VmStrike | null;
    /** Addresses of every command that ran during this frame. */
    lines: number[];
    /** Sum of `step` operands run during the frame (quarter pixels, before `$0F36`). */
    step: number;
    /** Set when a `hold_random` chose the timer: the range of ticks it can take. */
    random?: [number, number];
    /** Projectiles thrown during this frame. */
    spawns: VmSpawn[];
}

export interface VmResult {
    frames: VmFrame[];
    /** True when the script came back round (`loop`, or a state already seen) or a one-shot ended on `end_check`. */
    complete: boolean;
    totalTicks: number;
    /** Where it stopped on a command of unknown width. */
    stoppedAt?: number;
}

const MAX_TICKS = 6000;
const MAX_COMMANDS_PER_TICK = 256;
const MAX_FRAMES = 256;

const sameStrike = (a: VmStrike | null, b: VmStrike | null): boolean =>
    a === b || (!!a && !!b && a.dx === b.dx && a.dy === b.dy && a.width === b.width && a.height === b.height);

/**
 * Run a script from its start until it comes back round.
 *
 * Static assumptions, all of them the idle case: the entity is on screen, it
 * is not in state `$0100` (so `end_check` falls through), it has no linked
 * entity (`jump_if_linked` is not taken), and variables the script never set
 * read as zero. `hold_random` takes the middle of its range and says so.
 */
export function runAnimation(rom: Uint8Array, script: number): VmResult {
    let resume = script;
    let timer = 1;
    let sprite: number | null = null;
    let sprite2: number | null = null;
    const vars = new Map<number, number>();
    const frames: VmFrame[] = [];
    const seen = new Set<string>();
    let totalTicks = 0;
    let complete = false;
    let stoppedAt: number | undefined;
    let lastMnemonic = '';

    const v16 = (f: number) => (vars.get(f) ?? 0) | ((vars.get(f + 1) ?? 0) << 8);
    const set16 = (f: number, v: number) => { vars.set(f, v & 0xff); vars.set(f + 1, (v >> 8) & 0xff); };

    ticks: for (let tick = 0; tick < MAX_TICKS && frames.length < MAX_FRAMES; tick++) {
        const state = `${resume}:${timer}:${[...vars].join(',')}`;
        if (seen.has(state)) { complete = true; break; }
        seen.add(state);

        let q = resume;
        let strike: VmStrike | null = null;
        let step = 0;
        let random: [number, number] | undefined;
        const ran: number[] = [];
        const spawns: VmSpawn[] = [];
        for (let n = 0; n < MAX_COMMANDS_PER_TICK; n++) {
            const raw = at(rom, q);
            const o = opcode(raw);
            if (!o) {
                // A one-shot (a death, a vanish) ends on `end_check!`: the engine
                // retires the entity there, so what follows is never a command.
                if (ran.length === 0 && lastMnemonic === 'end_check') complete = true;
                else stoppedAt = q;
                break ticks;
            }
            lastMnemonic = o.mnemonic;
            ran.push(q);
            let next = q + o.length;
            const b = (i: number) => at(rom, q + i);
            switch (o.kind) {
                case 'hold': timer = raw & 0x7f; resume = next; break;
                case 'hold_operand': timer = b(1); resume = next; break;
                case 'hold_random':
                    timer = b(2) + (b(1) >> 1);
                    random = [b(2), b(2) + Math.max(0, b(1) - 1)];
                    resume = next;
                    break;
                case 'sprite': sprite = spriteOperand(rom, q); break;
                case 'sprite2': sprite2 = sprite2Operand(rom, q); break;
                case 'sprite_long': case 'sprite_aim': sprite = sprite24At(rom, q + 1); break;  // aim: the first angle
                case 'reset': sprite = null; sprite2 = null; break;
                case 'loop': complete = true; break ticks;
                case 'set8': vars.set(b(1), b(2)); break;
                case 'set16': set16(b(1), b(2) | (b(3) << 8)); break;
                case 'set24': vars.set(b(1), b(2)); set16(b(1) + 1, b(3) | (b(4) << 8)); break;
                case 'add8': vars.set(b(1), ((vars.get(b(1)) ?? 0) + b(2)) & 0xff); break;
                case 'add16': set16(b(1), v16(b(1)) + (b(2) | (b(3) << 8))); break;
                case 'clear': set16(b(1), 0); break;
                case 'dec_jnz': {
                    const v = (v16(b(1)) - 1) & 0xffff;
                    set16(b(1), v);
                    if (v !== 0) next = jumpTarget(rom, q, o.kind);
                    break;
                }
                case 'jump_pos': {
                    const v = (v16(b(1)) << 16) >> 16;
                    if (v > 0) next = jumpTarget(rom, q, o.kind);
                    break;
                }
                case 'jump': next = jumpTarget(rom, q, o.kind); break;
                case 'strike': strike = { dx: signed8(b(1)), dy: signed8(b(2)), width: b(3), height: b(4) }; break;
                case 'step': step += signed8(b(1)); break;
                case 'projectile':
                    spawns.push({ id: b(1) | (b(2) << 8), dx: signed8(b(3)), dy: signed8(b(4)), dz: signed8(b(5)), at: 0 });
                    break;
                default: break;           // loop restarts are where the run stops; jump_if_linked is not taken
            }
            if (raw & END_FRAME) {
                timer -= 1;
                if (timer <= 0) { timer = 1; resume = next; }
                const last = frames[frames.length - 1];
                if (last && last.sprite === sprite && last.sprite2 === sprite2 && sameStrike(last.strikeBox, strike)) {
                    for (const sp of spawns) sp.at = last.ticks;
                    last.ticks += 1;
                    last.step += step;
                    last.spawns.push(...spawns);
                    for (const a of ran) if (!last.lines.includes(a)) last.lines.push(a);
                    if (random) last.random = random;
                } else {
                    frames.push({ sprite, sprite2, ticks: 1, strikeBox: strike, lines: ran, step, random, spawns });
                }
                totalTicks += 1;
                continue ticks;
            }
            q = next;
        }
        break;                            // a tick that never ended: give up rather than spin
    }
    // A cycle's last frame runs straight into its first.
    const first = frames[0];
    const last = frames[frames.length - 1];
    if (complete && frames.length > 1 && first.sprite === last.sprite && first.sprite2 === last.sprite2
        && !first.strikeBox && !last.strikeBox) {
        frames.pop();
        // The tail plays first now: the old first frame's spawns move later by its length.
        for (const sp of first.spawns) sp.at += last.ticks;
        first.spawns = [...last.spawns, ...first.spawns];
        first.ticks += last.ticks;
        first.step += last.step;
        for (const a of last.lines) if (!first.lines.includes(a)) first.lines.push(a);
    }
    return { frames, complete, totalTicks, stoppedAt };
}
