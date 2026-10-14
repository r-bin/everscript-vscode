// Ownership: running a script to every end it can reach. Pure.
//
// Depth-first over forks, capped. A path is finished by END of the entry
// script, by a loop that came round again, or by something the model cannot
// follow — and it says which, because "this is everything that can happen" is
// only true for paths that ended on END.

import { Sym, key } from './sym';
import { Memory, Pin } from './memory';
import { Machine } from './machine';
import { PathState, Step, SimEntity, EndReason } from './state';
import { step } from './step';
import { joinPoints } from './cfg';

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
    return opts.rejoin ? simulateRejoining(m, entry, opts) : simulatePaths(m, entry, opts);
}

/** A fork inside a call whose sides only meet when the call returns. */
const AT_RETURN = -1;

/**
 * Paths that split at a branch wait at its join (cfg.ts, per script) until
 * every sibling has arrived there or ended, and merge. Inside a call, sides
 * that only meet on the way out wait at the return instead. So a helper that
 * tests ten independent things costs one merged path, not 1024.
 */
function simulateRejoining(m: Machine, entry: number, opts: SimOptions): SimResult {
    const maxPaths = opts.maxPaths ?? 512;
    const maxSteps = opts.maxSteps ?? 400000;
    const joinCache = new Map<number, Map<number, number | null>>();
    const joinsOf = (e: number): Map<number, number | null> => {
        if (!joinCache.has(e)) joinCache.set(e, joinPoints(m, e));
        return joinCache.get(e)!;
    };
    const paths: SimPath[] = [];
    const live = new Map<number, number>();
    const waiting = new Map<number, PathState[]>();
    const todo: PathState[] = [new PathState(entry, new Memory(opts.pins ?? []), opts.name ?? 'script')];
    let nextFork = 0, loopsCut = 0, steps = 0;
    let capped = false;

    const retire = (x: PathState): void => {
        if (x.end === 'loop' && x.depth > 0) loopsCut++; else paths.push(finish(x));
        for (const f of [...x.forks].reverse()) settle(f.id, -1);
    };
    const settle = (id: number, delta: number): void => {
        live.set(id, (live.get(id) ?? 0) + delta);
        if (live.get(id)! > 0) return;
        const group = waiting.get(id) ?? [];
        waiting.delete(id);
        if (!group.length) return;
        const merged = mergeGroup(group);
        for (const r of merged) r.forks = r.forks.filter((f) => f.id !== id);
        for (const f of merged[0].forks) live.set(f.id, live.get(f.id)! - (group.length - merged.length));
        todo.push(...merged);
    };
    const wait = (s: PathState, idx: number): void => {
        for (const f of s.forks.splice(idx + 1).reverse()) settle(f.id, -1);
        const f = s.forks[idx];
        waiting.set(f.id, [...(waiting.get(f.id) ?? []), s]);
        settle(f.id, -1);
    };

    while (todo.length) {
        if (paths.length + todo.length > maxPaths || steps > maxSteps) { capped = true; break; }
        const s = todo.pop()!;
        // Left the call a fork was opened in: wait at the return, or give the fork up.
        let top = s.forks[s.forks.length - 1];
        while (top && s.depth < top.depth && top.join !== AT_RETURN) { s.forks.pop(); settle(top.id, -1); top = s.forks[s.forks.length - 1]; }
        if (top && s.depth < top.depth) { wait(s, s.forks.length - 1); continue; }
        const at = s.forks.findIndex((f) => f.join === s.pc && f.depth === s.depth);
        if (at >= 0) { wait(s, at); continue; }
        const pc = s.pc, depth = s.depth, frameEntry = s.frame.entry;
        steps++;
        const next = step(m, s);
        if (next.length === 0) { retire(s); continue; }
        if (next.length === 2) {
            for (const f of s.forks) live.set(f.id, live.get(f.id)! + 1);
            const join = joinsOf(frameEntry).get(pc);
            const target = join ?? (depth > 0 ? AT_RETURN : null);
            if (target !== null && depth >= (opts.joinDepth ?? 0)) {
                const id = nextFork++;
                live.set(id, 2);
                for (const x of next) x.forks = [...x.forks, { id, join: target, depth }];
            }
        }
        todo.push(...next);
    }
    return { entry, paths, capped, loopsCut };
}

/**
 * Merge every path waiting at one address as far as possible. Pairs that
 * split latest go first — the innermost `if` closes before the one around it,
 * or the outer merge would leave nothing for the inner one to match.
 */
function mergeGroup(group: PathState[]): PathState[] {
    const shared = (a: PathState, b: PathState): number => {
        let n = 0;
        while (n < a.steps.length && n < b.steps.length && a.steps[n] === b.steps[n]) n++;
        return n;
    };
    // Identical states first: one pass, by key.
    const byKey = new Map<string, PathState>();
    for (const s of group) {
        const k = s.mergeKey();
        const into = byKey.get(k);
        if (into) into.absorb(s); else byKey.set(k, s);
    }
    group = [...byKey.values()];
    for (;;) {
        let best: { i: number; j: number; n: number } | null = null;
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const n = shared(group[i], group[j]);
                if (!best || n > best.n) best = { i, j, n };
            }
        }
        if (!best) return group;
        const a = group[best.i], b = group[best.j];
        const merged: PathState | null = a.rejoin(b);
        if (!merged) {
            // This pair cannot be one `if`; try the rest without it.
            const others = group.filter((_, k) => k !== best!.i && k !== best!.j);
            const restMerged = mergeGroup([a, ...others]);
            return restMerged.length < others.length + 1 ? mergeGroup([...restMerged, b]) : [...restMerged, b];
        }
        group = [merged, ...group.filter((_, k) => k !== best!.i && k !== best!.j)];
    }
}

function simulatePaths(m: Machine, entry: number, opts: SimOptions): SimResult {
    const maxPaths = opts.maxPaths ?? 512;
    // Rounds: every live path runs until it ends or a call returns into the
    // entry script. There, paths with the same merge key become one — forks a
    // shared helper (fade, text box) made internally and that changed nothing
    // the entry script can see. Without this every helper doubles every path.
    let frontier: PathState[] = [new PathState(entry, new Memory(opts.pins ?? []), opts.name ?? 'script')];
    const paths: SimPath[] = [];
    let capped = false;
    let loopsCut = 0;
    let steps = 0;
    const maxSteps = opts.maxSteps ?? 200000;
    while (frontier.length && !capped) {
        const arrived = new Map<string, PathState>();
        const todo = frontier;
        while (todo.length) {
            if (paths.length + arrived.size >= maxPaths) { capped = true; break; }
            let s = todo.pop()!;
            for (;;) {
                if (++steps > maxSteps) { capped = true; break; }
                const next = step(m, s);
                if (next.length === 0) {
                    // A helper's wait-loop coming round again is the "still waiting"
                    // branch of a fork whose other branch already left the loop.
                    if (s.end === 'loop' && s.depth > 0) loopsCut++;
                    else paths.push(finish(s));
                    break;
                }
                if (next.length === 2) todo.push(next[1]);
                s = next[0];
                if (s.returnedToEntry) {
                    s.returnedToEntry = false;
                    const k = s.mergeKey();
                    const into = arrived.get(k);
                    if (into) into.absorb(s); else arrived.set(k, s);
                    break;
                }
            }
        }
        if (steps > maxSteps) capped = true;
        frontier = [...arrived.values()];
    }
    return { entry, paths, capped, loopsCut };
}

function finish(s: PathState): SimPath {
    const assumptions: SimPath['assumptions'] = [];
    const seen = new Set<string>();
    for (const st of s.steps) {
        if (st.kind !== 'decide') continue;
        const k = key(st.cond);
        // Only the first test of a condition was a choice; later ones followed from it.
        if (seen.has(k) || !isUndecided(st.cond) || !s.holds(st.cond)) continue;
        seen.add(k);
        assumptions.push({ cond: st.cond, src: st.src, value: st.value, at: st.at, depth: st.depth });
    }
    return { steps: s.steps, end: s.end ?? 'end', diff: s.mem.diff(), entities: s.entities, assumptions, merged: s.merged, either: s.either };
}

function isUndecided(cond: Sym): boolean {
    return cond.k !== 'c';
}
