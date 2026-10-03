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
import { opcode, lengthAt, segmentsAt, spriteOperand, sprite2Operand, sprite24At, jumpTarget, END_FRAME, SEGMENT_FIRST, SEGMENT_STRIDE } from './animation-opcodes';

const at = (rom: Uint8Array, snes: number): number => readByte(rom, snesToRom(snes));
const signed8 = (v: number): number => (v << 24) >> 24;
const signed16 = (v: number): number => (v << 16) >> 16;

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

/**
 * How the entity moves, all from the code:
 *
 * - `step n` (`$90866C`) moves `(n + f) >> 2` px along the facing, where `f` is
 *   `$0F36`, which steps 0, 3, 1, 2 every tick (`$8FAFCA`, table `$8FB090`): a
 *   dither, so `step n` averages exactly n/4 px per tick. Negative n moves
 *   backwards (facing ^ 8). Direction per facing is `$8FAF18`.
 * - Height (+0x1E, 1/16 px) and vertical speed (+0x20) integrate once per tick
 *   at `$8FAFF5`: h' = h + v - 1; at or below 0 the entity lands (both 0),
 *   otherwise h = h' and v -= 1. `hop v` (`$9086E5`) sets the speed unless h is
 *   already `$640` or more; `wait_landed` (`$9086C3`) adds a tick to the frame
 *   timer while h or v is non-zero, holding the frame until it lands.
 *
 * Not modelled: the mover's per-entity cap (+0x64) and collision, `0x44`'s
 * comparison against the global `$0E96`, and `hop_maybe`'s coin toss (taken).
 */
const DITHER = [0, 3, 1, 2];
const DIRECTION: Record<number, [number, number]> = {
    0: [0, -1], 2: [1, -1], 4: [1, 0], 6: [1, 1],
    8: [0, 1], 10: [-1, 1], 12: [-1, 0], 14: [-1, -1],
};
const HOP_CEILING = 0x640;
/**
 * `hover_hold` (`0x44`) adds a tick while height >= `$0E96`, which `$8FDC46` rolls
 * as `$100 + rand(0..$1F0)` (16–47 px). The middle of that range is used.
 */
export const HOVER_HEIGHT = 0x100 + 0xf8;
/** Mode (+0x16) bit the hit test refuses a target for (`$8FB61E`: `$0016 & $0020`). */
export const MODE_INVULNERABLE = 0x20;
/** Height is kept in 1/16 px. */
export const HEIGHT_UNITS = 16;

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
    /** Where the thrower stood (px from its start) and its height (1/16 px) at that moment. */
    ex: number;
    ey: number;
    ez: number;
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
    /** Position after each tick of the frame: [x px, y px, height in 1/16 px], from the start. */
    motion: Array<[number, number, number]>;
    /** Mode (+0x16) during the frame; bit `$20` means it cannot be hit. */
    mode: number;
    /**
     * A segmented body (Tar Skull, Salabog): each segment's sprite, and where every segment
     * is drawn after each tick of the frame — `ticks[t][k] = [x, y]` from the feet.
     */
    segments: { sprites: number[]; ticks: Array<Array<[number, number]>> } | null;
    /** Hurt-region offset (+0x42, +0x44) at the end of the frame. */
    hurt: [number, number];
}

export interface VmResult {
    frames: VmFrame[];
    /** True when the script came back round (`loop`, or a state already seen) or a one-shot ended on `end_check`. */
    complete: boolean;
    totalTicks: number;
    /** Where it stopped on a command of unknown width. */
    stoppedAt?: number;
    /** True when the entity moves or leaves the ground at any point. */
    moves: boolean;
    /**
     * Playback tick a loop resumes at. 0 normally; later when the entity was still in the
     * air at `loop` and the run carried on until its motion repeated (a hovering flier).
     */
    loopFrom: number;
}

/**
 * One entry of the segment list at +0x86 (`$8FCA02`): 14 bytes — sprite (+0..2),
 * depth (+3), x/y countdowns (+4, +5), x/y positions as 8.8 (+6/+7, +8/+9),
 * x/y velocities (+0x0A, +0x0B), x/y targets (+0x0C, +0x0D).
 */
interface Segment { sprite: number; depth: number; count: [number, number]; pos: [number, number]; vel: [number, number]; target: [number, number] }

const EASE_DISTANCE = 0x8fcb18;   // share of the remaining distance per countdown step
const EASE_VELOCITY = 0x8fca50;   // share of the last step's velocity carried on

/** The Mode 7 multiplier as `$8FC905` uses it: signed 16 × signed 8, middle 16 bits ($2135). */
const m7 = (a: number, b: number): number => ((((a << 16) >> 16) * signed8(b)) >> 8) & 0xffff;

/** `$8FC905` for one axis of one segment. */
function easeAxis(rom: Uint8Array, s: Segment, axis: 0 | 1): void {
    if (s.count[axis] < 3) {
        s.pos[axis] = (s.target[axis] & 0xff) << 8;
        s.vel[axis] = 0;
        return;
    }
    s.count[axis] -= 1;
    const c = s.count[axis];
    const delta = (s.target[axis] - (s.pos[axis] >> 8)) & 0xff;
    const step = (m7(read16At(rom, EASE_DISTANCE + c * 2), delta) + m7(read16At(rom, EASE_VELOCITY + c * 2), s.vel[axis])) & 0xffff;
    s.pos[axis] = (s.pos[axis] + step) & 0xffff;
    s.vel[axis] = (((step >>> 3) + 1) >>> 1) & 0xff;
}

export interface RunOptions {
    /** The sprite on screen when the animation starts — what a script that never sets one keeps showing. */
    initialSprite?: number | null;
    /**
     * An attack, damage, death or cast: `end_check` hands the entity back to its AI, so a
     * run still in the air at `loop` holds its last frame until it lands, then ends —
     * rather than starting the attack again mid-air. Idles and walks loop on.
     */
    oneShot?: boolean;
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
export function runAnimation(rom: Uint8Array, script: number, facing = 8, opts: RunOptions = {}): VmResult {
    let resume = script;
    let restart = script;
    let mode = 0;
    let segList: Segment[] | null = null;
    let hurt: [number, number] = [0, -16];
    const seenAt = new Map<string, number>();
    let loopFrom = 0;
    let landing = false;
    let x = 0;
    let y = 0;
    let h = 0;
    let v = 0;
    let phase = 0;
    let moves = false;
    const move = (dir: number, d: number) => {
        const [ux, uy] = DIRECTION[dir & 0x0e];
        x += ux * d;
        y += uy * d;
        if (d) moves = true;
    };
    let timer = 1;
    let sprite: number | null = opts.initialSprite ?? null;
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
        if (landing) {
            // A one-shot falling after its script ended: physics only, last frame held.
            const h2 = h + v - 1;
            if (h2 <= 0) { h = 0; v = 0; } else { h = h2; v -= 1; }
            const last = frames[frames.length - 1];
            if (last) { last.ticks += 1; last.motion.push([x, y, h]); if (last.segments) last.segments.ticks.push(last.segments.ticks[last.segments.ticks.length - 1]); }
            totalTicks += 1;
            if (h === 0 && v === 0) { complete = true; break; }
            continue;
        }
        // Height and speed are part of the state: mid-air, the same pointer is not a repeat.
        const segState = segList ? segList.map((g) => `${g.count}|${g.pos}|${g.vel}|${g.target}`).join(';') : '';
        const state = `${resume}:${timer}:${h}:${v}:${mode}:${[...vars].join(',')}:${segState}`;
        if (seen.has(state)) { complete = true; loopFrom = seenAt.get(state) ?? 0; break; }
        seen.add(state);
        seenAt.set(state, totalTicks);

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
            let next = q + lengthAt(rom, q);
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
                // HUD: drawn at fixed screen spots, not on the entity; a preview shows entry 0.
                case 'hud': if (sprite === null) sprite = sprite24At(rom, q + 1); break;
                case 'reset': sprite = null; sprite2 = null; mode = 0; hurt = [0, -16]; break;
                case 'hurtbox': hurt = [signed16(b(1) | (b(2) << 8)), signed16(b(3) | (b(4) << 8))]; break;
                case 'loop':
                    if (h !== 0 || v !== 0) {
                        if (opts.oneShot) { landing = true; continue ticks; }
                        // Still in the air: the game carries on from here, so the run does
                        // too, until its whole state (height included) repeats.
                        next = restart;
                        break;
                    }
                    complete = true;
                    break ticks;
                case 'restart_here': restart = next; break;
                case 'mode': mode = b(1) | (b(2) << 8); break;
                case 'hover_hold': if (h >= HOVER_HEIGHT) timer += 1; break;
                case 'segments': {
                    const sg = segmentsAt(rom, q);
                    const sprites: number[] = [];
                    for (const g of sg.groups) for (let i = 0; i < (g.count || sg.total) && sprites.length < sg.total; i++) sprites.push(g.sprite);
                    segList = sprites.map((sp) => ({ sprite: sp, depth: 0, count: [0, 0], pos: [0, 0], vel: [0, 0], target: [0, 0] }));
                    break;
                }
                case 'segment': {
                    // $8FC8DE: depth, both countdowns and both targets; positions ease there.
                    const k = (b(1) - SEGMENT_FIRST) / SEGMENT_STRIDE;
                    const sg = segList ? segList[k] : undefined;
                    if (sg) {
                        sg.depth = signed8(b(2));
                        sg.count = [b(3), b(4)];
                        sg.target = [signed8(b(5)), signed8(b(6))];
                    }
                    break;
                }
                case 'segment_step':
                    if (segList && segList.length) {
                        for (const sg of segList) { easeAxis(rom, sg, 0); easeAxis(rom, sg, 1); }
                        // $908886: the hurt region follows the head.
                        hurt = [signed8(segList[0].pos[0] >> 8), signed8(segList[0].pos[1] >> 8)];
                    }
                    break;
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
                case 'step': {
                    const n = signed8(b(1));
                    step += n;
                    move(n >= 0 ? facing : facing ^ 8, ((Math.abs(n) + DITHER[phase]) & 0xff) >> 2);
                    break;
                }
                case 'hop': v = h < HOP_CEILING ? signed16(b(1) | (b(2) << 8)) : 0; break;
                case 'hop_maybe': if (h === 0) v = signed16(b(1) | (b(2) << 8)); break;
                case 'wait_landed': if (h !== 0 || v !== 0) timer += 1; break;
                case 'projectile':
                    spawns.push({ id: b(1) | (b(2) << 8), dx: signed8(b(3)), dy: signed8(b(4)), dz: signed8(b(5)), at: 0, ex: x, ey: y, ez: h });
                    break;
                default: break;           // loop restarts are where the run stops; jump_if_linked is not taken
            }
            // A one-shot (attack, knockback, death, cast) is over at `end_check`: it hands the
            // entity back to its AI — or, for a death, retires it. Running on reads the next
            // character's script (deaths are stored back to back).
            const oneShotEnds = !!opts.oneShot && o.mnemonic === 'end_check';
            if (raw & END_FRAME) {
                timer -= 1;
                if (timer <= 0) { timer = 1; resume = next; }
                // The tick's physics: gravity, then the dither moves on.
                const h2 = h + v - 1;
                if (h2 <= 0) { h = 0; v = 0; } else { h = h2; v -= 1; moves = true; }
                phase = (phase + 1) % DITHER.length;
                const sample: [number, number, number] = [x, y, h];
                const segSample = segList ? segList.map((sg) => [signed8(sg.pos[0] >> 8), signed8(sg.pos[1] >> 8)] as [number, number]) : null;
                const last = frames[frames.length - 1];
                const invulnerable = (mode & MODE_INVULNERABLE) !== 0;
                if (last && last.sprite === sprite && last.sprite2 === sprite2 && sameStrike(last.strikeBox, strike)
                    && ((last.mode & MODE_INVULNERABLE) !== 0) === invulnerable) {
                    for (const sp of spawns) sp.at = last.ticks;
                    last.ticks += 1;
                    last.step += step;
                    last.spawns.push(...spawns);
                    last.motion.push(sample);
                    if (last.segments && segSample) last.segments.ticks.push(segSample);
                    last.hurt = hurt;
                    for (const a of ran) if (!last.lines.includes(a)) last.lines.push(a);
                    if (random) last.random = random;
                } else {
                    frames.push({ sprite, sprite2, ticks: 1, strikeBox: strike, lines: ran, step, random, spawns, motion: [sample], mode, hurt,
                        segments: segList && segSample ? { sprites: segList.map((sg) => sg.sprite), ticks: [segSample] } : null });
                }
                totalTicks += 1;
                if (oneShotEnds && timer === 1) {
                    if (h !== 0 || v !== 0) { landing = true; continue ticks; }
                    complete = true;
                    break ticks;
                }
                continue ticks;
            }
            if (oneShotEnds) {
                if (h !== 0 || v !== 0) { landing = true; continue ticks; }
                complete = true;
                break ticks;
            }
            q = next;
        }
        break;                            // a tick that never ended: give up rather than spin
    }
    // A cycle's last frame runs straight into its first.
    const first = frames[0];
    const last = frames[frames.length - 1];
    // Not when it moves: the tail stands where the cycle ends, not where it starts.
    if (complete && !moves && loopFrom === 0 && frames.length > 1 && first.sprite === last.sprite && first.sprite2 === last.sprite2
        && !first.strikeBox && !last.strikeBox && first.mode === last.mode) {
        frames.pop();
        // The tail plays first now: the old first frame's spawns move later by its length.
        for (const sp of first.spawns) sp.at += last.ticks;
        first.spawns = [...last.spawns, ...first.spawns];
        first.ticks += last.ticks;
        first.step += last.step;
        first.motion = [...last.motion, ...first.motion];
        if (first.segments && last.segments) first.segments.ticks = [...last.segments.ticks, ...first.segments.ticks];
        for (const a of last.lines) if (!first.lines.includes(a)) first.lines.push(a);
    }
    return { frames, complete, totalTicks, stoppedAt, moves, loopFrom };
}
