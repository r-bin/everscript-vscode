// Ownership: the game's script scheduler between two turns ($8C:CFFD) — the
// next thread in run-list order, a new tick after the last one, sleepers and
// engine waits woken when due, time jumping over passes where nothing runs.
// Pure. Its model is in knowledge/rom/8ccffd.md; scheduler.test.js checks it
// against the running game.

import { Sym, key, c } from './sym';
import { PathState, Thread } from './state';
import { TimePoint, START } from './time';
import { RNG_STATE } from './rng';
import type { SimOptions } from './explore';

export function dueOf(t: Thread): TimePoint {
    return t.wait.k === 'sleep' ? t.wait.until : t.wait.k === 'engine' ? { base: t.wait.event, off: 0 } : START;
}
/**
 * The game's scheduler between two turns ($8C:CFFD): the next thread in run-list
 * order, a new tick after the last one, sleepers and engine waits woken when
 * due. Returns the paths ready for their next turn, or ended (`end` set).
 */
export function between(s: PathState, opts: SimOptions): PathState[] {
    s.turnOver = false;
    s.turnTime = null;
    s.turnReadTimer = false;
    const removed = s.threadDone ? s.cur : -1;
    if (s.threadDone) { s.threads.splice(s.cur, 1); s.threadDone = false; } else s.cur++;
    if (s.resumeCur !== null) {
        // An inserted turn is over: back to the thread whose turn it preceded.
        s.cur = removed >= 0 && removed < s.resumeCur ? s.resumeCur - 1 : s.resumeCur;
        s.resumeCur = null;
    }
    return schedule(s, opts);
}

export function schedule(s: PathState, opts: SimOptions): PathState[] {
    for (;;) {
        if (!s.threads.length) { s.end = 'end'; return [s]; }
        if (s.cur >= s.threads.length) {
            const r = newTick(s, opts);
            if (r) return r;
        }
        const t = s.threads[s.cur];
        if (t.wait.k === 'run') return [s];
        const due: TimePoint = t.wait.k === 'sleep' ? t.wait.until : { base: t.wait.event, off: 0 };
        const known = s.clock.ge(s.clock.now, due);
        if (known === true) { wake(s, t, due); return [s]; }
        // A visual thread (analysis only): when it wakes cannot matter, so it runs as soon
        // as it may, at its own moment, without a fork.
        if (known === null && s.visualOf?.(t)) { wake(s, t, due); return [s]; }
        // Not due, or not known to be: deferred. While other threads run, the
        // simulate loop forks only when this thread's next turn and theirs do
        // not commute (por.ts); when nothing runs, newTick jumps to it.
        s.cur++;
    }
}

/** Wake `t` for its turn; a wait that ended at a symbolic moment plays the turn at that moment. */
export function wake(s: PathState, t: Thread, due: TimePoint): void {
    const why = t.wait.k === 'sleep' ? 'sleep over' : t.wait.k === 'engine' ? `${t.wait.what} done` : '';
    t.wait = { k: 'run' };
    s.turnTime = due.base >= 0 && s.clock.ge(due, s.clock.now) !== true ? due : null;
    s.steps.push({ kind: 'event', event: { at: t.pc, depth: t.frames.length - 1, opcode: -1, summary: `wake: ${why}`, thread: t.frames[0].slot, tid: t.uid, time: s.time, type: 'wake', why } });
}

/** Keep a timing choice as a condition of the path, like any other undecided test. */
export function recordTiming(s: PathState, due: TimePoint, done: boolean, at: TimePoint = s.clock.now): void {
    s.clock.assume(at, due, done);
    const cond: Sym = { k: 'atom', name: `${s.clock.render(due)} by ${s.clock.render(at)}`, volatile: false };
    s.assume(cond, done);
    s.steps.push({ kind: 'decide', at: 0, depth: 0, cond, src: key(cond), value: done, summary: 'timing' });
}

/**
 * After the last thread of a pass. A pass where nothing but waiting happened
 * repeats itself until something wakes, so time jumps to the next wake —
 * forking when the constraints cannot say which comes first. With nothing
 * left to wake, the path has settled ('idle').
 */
function newTick(s: PathState, opts: SimOptions): PathState[] | null {
    // Quiet: nothing but waiting happened, and every thread is where it was a tick ago —
    // a pass that will repeat itself until something wakes. A thread that yielded at a
    // new place is not a repeat, even if it did nothing else.
    const where = s.threadsKey() + '#' + s.mem.fingerprint();
    const quiet = !s.tickActive && !s.readTimer && where === s.lastTickKey;
    s.lastTickKey = where;
    s.tickActive = false;
    s.readTimer = false;
    s.cur = 0;
    if (++s.ticks > (opts.maxTicks ?? 3600)) { s.end = 'horizon'; return [s]; }
    const now = s.clock.now;
    if (!quiet) { s.clock.now = s.clock.later(now, 1); engineTick(s, opts); return null; }
    const pending: TimePoint[] = [];
    for (const t of s.threads) {
        if (t.wait.k === 'sleep') pending.push(t.wait.until);
        if (t.wait.k === 'engine') pending.push({ base: t.wait.event, off: 0 });
    }
    if (!pending.length) { s.end = 'idle'; return [s]; }
    const nextTick = s.clock.later(now, 1);
    const firsts = pending.filter((p) => !pending.some((q) => q !== p && s.clock.ge(q, p) === false));
    const out: PathState[] = [];
    for (const p of firsts) {
        const base = firsts.length > 1 ? s.clone() : s;
        for (const q of pending) if (q !== p && base.clock.ge(q, p) === null) recordOrder(base, q, p);
        // Jump to p — or, if p may already be past (deferred while others ran), it is due at the next tick.
        const future = base.clock.ge(p, nextTick);
        const sides: Array<[PathState, boolean]> = future === null ? [[base.clone(), true], [base, false]] : [[base, future]];
        for (const [x, ahead] of sides) {
            if (future === null) recordTiming(x, p, !ahead, nextTick);
            x.clock.now = ahead ? p : nextTick;
            engineTick(x, opts);
            out.push(x);
        }
    }
    return out.flatMap((x) => schedule(x, opts));
}

/** What the engine does between passes that scripts can see: it draws from the RNG. */
function engineTick(s: PathState, opts: SimOptions): void {
    const tick = s.clock.now.base < 0 ? s.clock.now.off : -1;
    const known = tick >= 0 ? opts.rngAtTick?.(tick) : undefined;
    if (known) { for (let i = 0; i < 4; i++) s.mem.writeWord(RNG_STATE + 2 * i, c(known[i])); s.rngUnknown = false; }
    else s.rngUnknown = true;
}

function recordOrder(s: PathState, later: TimePoint, first: TimePoint): void {
    s.clock.assume(later, first, true);
    const cond: Sym = { k: 'atom', name: `${s.clock.render(first)} no later than ${s.clock.render(later)}`, volatile: false };
    s.assume(cond, true);
    s.steps.push({ kind: 'decide', at: 0, depth: 0, cond, src: key(cond), value: true, summary: 'timing' });
}
