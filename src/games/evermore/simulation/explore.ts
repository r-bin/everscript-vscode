// Ownership: running a script to every end it can reach. Pure.
//
// Depth-first over forks, capped. A path is finished by END of the entry
// script, by a loop that came round again, or by something the model cannot
// follow — and it says which, because "this is everything that can happen" is
// only true for paths that ended on END.

import { Sym } from './sym';
import { Memory, Pin } from './memory';
import { Machine } from './machine';
import { PathState, Step, SimEntity, EndReason, Thread, SLOT_BASE } from './state';
import { reach, isVisual } from './reach';
import { playTurn, Ended, Counters } from './turn';
import { between, schedule } from './scheduler';

export interface SimOptions {
    /** Starting WRAM bytes the caller vouches for (`$7E` offsets). */
    pins?: readonly Pin[];
    /** Stop forking after this many finished paths. */
    maxPaths?: number;
    name?: string;
    /**
     * Merge paths where the entry script's branches rejoin, so only branches
     * that never meet again (an `END` on one side) stay separate paths. What
     * the rejoined branches did is kept as `branch` steps. Use it for room
     * scripts; leave it off to list every outcome of a small script.
     */
    rejoin?: boolean;
    /** Give up (and say `capped`) after this many instructions in total. */
    maxSteps?: number;
    /** Stop a path after this many ticks of script time (`end: 'horizon'`); default one minute. */
    maxTicks?: number;
    /**
     * How many ticks an engine wait (0x2e) takes, when the caller knows — a
     * trace of the real game, say. Called with the waiting slot, the wait's
     * address and the tick it started (ticks since the start). Undefined: unknown.
     */
    engineWait?: (slot: number, pc: number, tick: number) => number | undefined;
    /** Keep every executed instruction as [tick, slot, pc] in `SimPath.log`. */
    log?: boolean;
    /**
     * The RNG state ($0133..$0139) at the start of a tick, when known. The
     * engine draws from the same generator between passes (~3 times a tick,
     * traced), so without this the state is unknown again at every tick.
     */
    rngAtTick?: (tick: number) => number[] | undefined;
    /** Start from this state instead of one thread at `entry` (see snapshot.ts). */
    start?: PathState;
    /** Called with the live paths after every round (diagnostics). */
    debug?: (live: PathState[]) => void;
    /**
     * Merge paths that differ only in where *visual* threads are (reach.ts:
     * threads that can only move and animate entities). For room analysis with
     * unknown engine timing; never for exact runs. The report says it was used.
     */
    abstractVisual?: boolean;
    /**
     * With `rejoin`: only branches at this call depth or deeper rejoin. 1 keeps
     * every outcome of the script itself apart while helpers still merge.
     */
    joinDepth?: number;
}

export interface SimPath {
    /** What this path did and decided, in order. */
    steps: Step[];
    end: EndReason;
    /** WRAM at the end, as a difference from the start. */
    diff: Array<{ addr: number; size: 1 | 2; value: Sym }>;
    entities: SimEntity[];
    /** How many raw paths this one stands for: helper-internal forks that made no difference. */
    merged: number;
    /** Conditions the merged paths disagreed on — this outcome holds either way. */
    either: Sym[];
    /** With `log`: every executed instruction as [tick, slot, pc]. */
    log?: Array<[number, number, number]>;
    /** The undecided conditions this path assumed: what makes it *this* path. */
    assumptions: Array<{ cond: Sym; src: string; value: boolean; at: number; depth: number }>;
}

export interface SimResult {
    entry: number;
    paths: SimPath[];
    /** True when the fork cap stopped the exploration early. */
    capped: boolean;
    /** Wait-loops inside helpers that were cut on their second round (not outcomes). */
    loopsCut: number;
}

export function simulate(m: Machine, entry: number, opts: SimOptions = {}): SimResult {
    const maxPaths = opts.maxPaths ?? 512;
    const maxSteps = opts.maxSteps ?? 400000;
    const paths = new Ended();
    let frontier: PathState[] = [opts.start ?? new PathState(entry, new Memory(opts.pins ?? []), opts.name ?? 'script')];
    const visualOf = opts.abstractVisual
        ? (t: Thread): boolean => t.frames[0].slot !== SLOT_BASE && [t.pc, ...t.frames.map((f) => f.ret).filter((r): r is number => r !== null)].every((pc) => isVisual(reach(m, pc)))
        : null;
    for (const s of frontier) { s.opts = opts; s.visualOf = visualOf; if (opts.log) s.log = []; }
    // A start taken from the game may begin with every thread waiting.
    frontier = frontier.flatMap((s) => schedule(s, opts)).filter((s) => !s.end || (paths.add(s), false));
    let capped = false;
    const counters: Counters = { loopsCut: 0, steps: 0, limit: maxSteps, over: false };
    // Rounds: every live path plays one thread's turn, then the scheduler picks
    // the next turn. Between turns, paths in the same state are one path.
    while (frontier.length) {
        if (paths.length + frontier.length > maxPaths || counters.steps > maxSteps || counters.over) { capped = true; break; }
        const next = new Map<string, PathState>();
        const keep = (u: PathState): void => {
            if (u.end) { paths.add(u); return; }
            u.compactClock();
            const k = u.mergeKey();
            const into = next.get(k);
            if (into) into.absorb(u); else next.set(k, u);
        };
        for (const s0 of frontier) {
            for (const t of playTurn(m, s0, opts, counters, paths, keep)) for (const u of between(t, opts)) keep(u);
            if (counters.steps > maxSteps) break;
        }
        frontier = [...next.values()];
        if (opts.debug) opts.debug(frontier);
    }
    return { entry, paths: paths.list(), capped: capped || counters.over, loopsCut: counters.loopsCut };
}

