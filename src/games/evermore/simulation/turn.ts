// Ownership: playing one thread's turn on a path and everything it forks
// into — rejoining branches at their join, deferring engine waits whose turn
// commutes with this one (por.ts), and collecting finished paths. Pure.

import { Sym, key } from './sym';
import { Machine } from './machine';
import { PathState } from './state';
import { step } from './step';
import { joinPoints } from './cfg';
import { Footprint, emptyFootprint, union, resourcesOf, conflicts } from './por';
import { dueOf, wake, recordTiming } from './scheduler';
import type { SimOptions, SimPath } from './explore';
/**
 * One turn, with the reduction for deferred waits: if a thread is waiting on
 * an event whose time is not settled, its next turn is played on a copy and
 * compared with this turn. If they commute, this turn stands and the wait
 * stays deferred. If not, the path splits: in one the event is over by now
 * (the waiting thread takes its turn at its place in this tick), in the other
 * it is not yet.
 */
export function playTurn(m: Machine, s0: PathState, opts: SimOptions, counters: Counters, paths: Ended,
    keep: (u: PathState) => void): PathState[] {
    const pending = deferred(s0);
    if (!pending.length) return runTurn(m, s0, opts, counters, paths);
    const pre = s0.clone();
    const track = { reads: new Set<number>(), writes: new Set<number>() };
    s0.mem.track = track;
    const before = s0.steps.length;
    const ends = runTurn(m, s0, opts, counters, paths);
    for (const e of ends) e.mem.track = null;
    let mine: Footprint = { ...emptyFootprint(), reads: track.reads, writes: track.writes };
    for (const e of ends) mine = union(mine, { ...emptyFootprint(), resources: resourcesOf(e.steps.slice(before)), timer: e.turnReadTimer });
    for (const xi of pending) {
        const theirs = speculate(m, pre, xi, opts, counters);
        if (!theirs.active && !theirs.starts && !conflicts(theirs, mine)) continue;
        const due = dueOf(pre.threads[xi]);
        // Not over yet: this turn stands.
        for (const e of ends) recordTiming(e, due, false);
        // Over by now: the waiting thread takes its turn at its place in this tick.
        const a = pre.clone();
        recordTiming(a, due, true);
        if (xi < a.cur) { a.resumeCur = a.cur; a.cur = xi; }
        if (xi < pre.cur) wake(a, a.threads[xi], due);
        keep(a);
        break;
    }
    return ends;
}

/** Threads waiting on a moment that may or may not have come. */
function deferred(s: PathState): number[] {
    const out: number[] = [];
    s.threads.forEach((t, i) => {
        if (i === s.cur || t.wait.k === 'run' || s.visualOf?.(t)) return;
        if (s.clock.ge(s.clock.now, dueOf(t)) === null) out.push(i);
    });
    return out;
}


/** What thread `idx`'s next turn would touch, played on a copy. */
function speculate(m: Machine, s: PathState, idx: number, opts: SimOptions, counters: Counters): Footprint {
    const x = s.clone();
    x.log = null;
    const t = x.threads[idx];
    const due = dueOf(t);
    x.cur = idx;
    t.wait = { k: 'run' };
    x.turnTime = due;
    const track = { reads: new Set<number>(), writes: new Set<number>() };
    x.mem.track = track;
    const before = x.steps.length, threads = x.threads.length;
    const sink = new Ended();
    const budget: Counters = { loopsCut: 0, steps: 0, limit: 20000, over: false };
    const ends = runTurn(m, x, opts, budget, sink);
    // Looking ahead costs as much as running: it counts against the same budget.
    counters.steps += budget.steps;
    // A turn too big to play out is treated as touching everything.
    let f: Footprint = { ...emptyFootprint(), reads: track.reads, writes: track.writes, active: sink.count > 0 || budget.over, timer: budget.over };
    for (const e of ends) {
        f = union(f, {
            ...emptyFootprint(), resources: resourcesOf(e.steps.slice(before)), timer: e.turnReadTimer,
            active: !e.threadDone && e.threads[e.cur]?.wait.k === 'run', starts: e.threads.length > threads,
        });
    }
    return f;
}

export interface Counters { loopsCut: number; steps: number; limit: number; over: boolean }

/** A fork inside a call whose sides only meet when the call returns. */
const AT_RETURN = -1;
const joinCache = new WeakMap<Machine, Map<number, Map<number, number | null>>>();

/**
 * Play the current thread's turn on `s0` and every path it forks into, up to
 * the end of the turn. With `rejoin`, paths that split at a branch wait at its
 * join (cfg.ts, per script) until every sibling has arrived or ended, and
 * merge; inside a call, sides that only meet on the way out wait at the
 * return. A side that ends its turn first gives the fork up — time has passed
 * for it, so it can no longer be the same state as its sibling.
 */
export function runTurn(m: Machine, s0: PathState, opts: SimOptions, counters: Counters, paths: Ended): PathState[] {
    if (!joinCache.has(m)) joinCache.set(m, new Map());
    const cache = joinCache.get(m)!;
    const joinsOf = (e: number): Map<number, number | null> => {
        if (!cache.has(e)) cache.set(e, joinPoints(m, e));
        return cache.get(e)!;
    };
    const turnEnds: PathState[] = [];
    const live = new Map<number, number>();
    const waiting = new Map<number, PathState[]>();
    s0.visited = new Set();
    s0.forks = [];
    const todo: PathState[] = [s0];
    let nextFork = 0;

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
    const leave = (x: PathState): void => { for (const f of [...x.forks].reverse()) settle(f.id, -1); x.forks = []; };
    const wait = (s: PathState, idx: number): void => {
        for (const f of s.forks.splice(idx + 1).reverse()) settle(f.id, -1);
        const f = s.forks[idx];
        waiting.set(f.id, [...(waiting.get(f.id) ?? []), s]);
        settle(f.id, -1);
    };

    while (todo.length) {
        const s = todo.pop()!;
        // Out of budget mid-turn: what is left of the turn is not explored (the run reports `capped`).
        if (counters.steps > counters.limit || todo.length > 4096) { counters.over = true; todo.length = 0; break; }
        if (s.turnOver) { leave(s); turnEnds.push(s); continue; }
        let top = s.forks[s.forks.length - 1];
        while (top && s.depth < top.depth && top.join !== AT_RETURN) { s.forks.pop(); settle(top.id, -1); top = s.forks[s.forks.length - 1]; }
        if (top && s.depth < top.depth) { wait(s, s.forks.length - 1); continue; }
        const at = s.forks.findIndex((f) => f.join === s.pc && f.depth === s.depth);
        if (at >= 0) { wait(s, at); continue; }
        const pc = s.pc, depth = s.depth, frameEntry = s.frame.entry;
        counters.steps++;
        const next = step(m, s);
        if (next.length === 0) {
            if (s.end === 'loop' && s.depth > 0) counters.loopsCut++; else paths.add(s);
            leave(s);
            continue;
        }
        if (next.length === 2) {
            for (const f of s.forks) live.set(f.id, live.get(f.id)! + 1);
            const join = opts.rejoin ? joinsOf(frameEntry).get(pc) : null;
            const target = join ?? (opts.rejoin && depth > 0 ? AT_RETURN : null);
            if (target !== null && depth >= (opts.joinDepth ?? 0)) {
                const id = nextFork++;
                live.set(id, 2);
                for (const x of next) x.forks = [...x.forks, { id, join: target, depth }];
            }
        }
        todo.push(...next);
    }
    return turnEnds;
}

/**
 * Merge every path waiting at one address as far as possible. Pairs that
 * split latest go first — the innermost `if` closes before the one around it,
 * or the outer merge would leave nothing for the inner one to match.
 */
function mergeGroup(group: PathState[]): PathState[] {
    // Paths share their history by reference up to where they split, never after:
    // the shared length is found by bisection.
    const shared = (a: PathState, b: PathState): number => {
        let lo = 0, hi = Math.min(a.steps.length, b.steps.length);
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (a.steps[mid - 1] === b.steps[mid - 1]) lo = mid; else hi = mid - 1;
        }
        return lo;
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


/**
 * Finished paths. Two that ended the same way — same reason, same WRAM, same
 * placed NPCs, same choices of the entry script — are one outcome reached by
 * different timings; they merge, and what they disagreed on is listed as
 * holding either way.
 */
export class Ended {
    private byKey = new Map<string, PathState>();
    count = 0;
    add(s: PathState): void {
        this.count++;
        const k = [s.end, s.mem.fingerprint(), s.rngUnknown, s.topTrail,
            s.entities.map((e) => `${e.label}@${e.refs.join(',')}`).join('|'), s.lastMap()].join('#');
        const into = this.byKey.get(k);
        if (into) into.absorb(s); else this.byKey.set(k, s);
    }
    list(): SimPath[] { return [...this.byKey.values()].map(finish); }
    get length(): number { return this.byKey.size; }
}

export function finish(s: PathState): SimPath {
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
    return { steps: s.steps, end: s.end ?? 'end', diff: s.mem.diff(), entities: s.entities, assumptions, merged: s.merged, either: s.either, log: s.log ?? undefined };
}

function isUndecided(cond: Sym): boolean {
    return cond.k !== 'c';
}
