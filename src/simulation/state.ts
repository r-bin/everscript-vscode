// Ownership: one simulated path — every script thread, WRAM, the clock, what
// it knows and what it did. Pure.
//
// A path forks when a condition depends on something the model does not know
// (simulation/virtual-wram.md: "undecided is a result"). Each fork records the
// condition and which way this path went; a later test of the same condition
// is then *decided*, so a path never holds a flag both set and clear.
//
// Threads mirror the game's run list ($7E2F28): order is run order, a script
// started with 0x07 joins at the end, and the slot numbers are the ones the
// game would allocate ($7E28FC + n*0x4F, first free), so a trace of the real
// game and a simulated path name threads the same way.

import { Sym, c, key, not, isC, truthy, ite, bin } from './sym';
import { Memory } from './memory';
import { Clock, TimePoint } from './time';

export interface Frame {
    /** Where the caller resumes, or null for the thread's first script. */
    ret: number | null;
    entry: number;
    args: Map<number, Sym>;
    name: string;
    /** The script slot this call runs in (a call gets a slot of its own). */
    slot: number;
    /** Started by the engine (arguments unknown) rather than by a script (unpassed arguments are 0). */
    root: boolean;
    /** The slot's owner entity (+0x0D), what operand 0x2e ("script owner") reads; calls and starts inherit it. */
    owner?: Sym;
}

/** What a thread is doing between its turns. */
export type Wait =
    | { k: 'run' }
    | { k: 'sleep'; until: TimePoint }
    /** An engine wait (opcode 0x2e): event `event` of the clock, at least one tick away. */
    | { k: 'engine'; event: number; what: string };

export interface Thread {
    /** Unique per path history: slots are reused, threads are not. */
    uid: number;
    pc: number;
    frames: Frame[];
    stack: Sym[];
    wait: Wait;
}

/** The game's script slots: 20 of 0x4F bytes from $7E28FC up to the run list at $7E2F28. */
export const SLOT_BASE = 0x28fc, SLOT_SIZE = 0x4f, SLOT_COUNT = 20;

export interface SimEntity {
    /** Stable across forks: the spawn instruction's address, ×16 plus a repeat count. */
    id: number;
    label: string;
    npc: number;
    x: number | null;
    y: number | null;
    /** Instruction that placed it. */
    at: number;
    /** WRAM words the script stored its handle in. */
    refs: number[];
    /** When it exists: 1 unless a merged branch placed it on one side only. */
    when: Sym;
}

/**
 * Something a path did. `depth` 0 is the thread's first script, 1+ inside
 * calls; `thread` is the slot of the thread's first script; `time` the tick.
 */
export type SimEvent = { at: number; depth: number; opcode: number; summary: string; thread: number; tid: number; time: string } & (
    | { type: 'write'; addr: number; size: 1 | 2; value: Sym; src: string }
    | { type: 'flag'; addr: number; bit: number; value: Sym; src: string }
    | { type: 'call'; target: number; name: string; async: boolean; args: Sym[]; global: number | null }
    | { type: 'spawn'; entity: number; label: string }
    | { type: 'map'; mapId: number; x: number; y: number }
    | { type: 'music'; track: number }
    | { type: 'text' }
    | { type: 'object'; index: Sym; value: Sym; when: Sym }
    | { type: 'wait' }
    | { type: 'wake'; why: string }
    | { type: 'thread-end' }
    /** A write to the thread's own arguments: local, touches nothing shared. */
    | { type: 'arg' }
    | { type: 'opaque' }
);

export type Step =
    | { kind: 'event'; event: SimEvent }
    | { kind: 'decide'; at: number; depth: number; cond: Sym; src: string; value: boolean; summary: string }
    /**
     * Two paths that split at `at` and met again: what each side did. The
     * paths' later steps are shared — this is an `if` that rejoins.
     */
    | { kind: 'branch'; at: number; depth: number; cond: Sym; src: string; summary: string; then: Step[]; else: Step[] };

export type EndReason = 'end' | 'map' | 'idle' | 'horizon' | 'loop' | 'recursion' | 'undecodable' | 'budget' | 'depth' | 'fork-cap';

export class PathState {
    threads: Thread[];
    /** Index of the thread whose turn it is. */
    cur = 0;
    clock = new Clock();
    /** Set by an instruction that ends the current thread's turn. */
    turnOver = false;
    /** Set by an END with no caller: the current thread is gone after this turn. */
    threadDone = false;
    /** Something other than waiting happened in the current tick (see explore.ts). */
    tickActive = false;
    /** The current tick read the timer, so the next tick may differ even if nothing else did. */
    readTimer = false;
    ticks = 0;
    /**
     * The true time of the turn being played when it is not the scheduler's
     * `now`: a thread whose engine wait was deferred (explore.ts) runs its
     * turn later in the simulation but at the event's own time.
     */
    turnTime: TimePoint | null = null;
    /** After an inserted turn (a deferred wait found due mid-tick), the run-list index to go back to. */
    resumeCur: number | null = null;
    /** The current turn read the timer. */
    turnReadTimer = false;
    /** The RNG state is not known (the engine drew from it since, see explore.ts engineTick). */
    rngUnknown = false;
    /** Room analysis only: threads whose phase does not matter (reach.ts). Set by explore.ts. */
    visualOf: ((t: Thread) => boolean) | null = null;
    /** Clock event ids below this belong to `now` and non-visual waits (see compactClock). */
    sharedNodes = 0;
    /** The options the path runs under (engine-wait oracle, logging). */
    opts: { engineWait?: (slot: number, pc: number, tick: number) => number | undefined } = {};
    /** [tick, slot, pc] of every executed instruction, when logging. */
    log: Array<[number, number, number]> | null = null;
    mem: Memory;
    lastEntity: Sym;
    /** Every condition this path assumed, by its rendering. */
    known = new Map<string, boolean>();
    /** How many paths were merged into this one (see explore.ts). */
    merged = 1;
    /** Conditions merged paths disagreed on: the outcome holds either way. */
    either: Sym[] = [];
    private conds = new Map<string, Sym>();
    /** Set by `ret` when a call returned into the entry script. */
    returnedToEntry = false;
    /** Open branches of the entry script this path is inside, innermost last (see explore.ts). */
    forks: Array<{ id: number; join: number; depth: number }> = [];
    steps: Step[] = [];
    entities: SimEntity[] = [];
    visited = new Set<string>();
    budget = 0;
    end: EndReason | null = null;
    freshCount = 0;

    constructor(entry: number, mem: Memory, name: string) {
        this.threads = [{ uid: 0, pc: entry, frames: [{ ret: null, entry, args: new Map(), name, slot: SLOT_BASE, root: true }], stack: [], wait: { k: 'run' } }];
        this.mem = mem;
        this.lastEntity = { k: 'atom', name: 'last entity', volatile: false };
    }

    get thread(): Thread { return this.threads[this.cur]; }
    get pc(): number { return this.thread.pc; }
    set pc(v: number) { this.thread.pc = v; }
    get frames(): Frame[] { return this.thread.frames; }
    set frames(v: Frame[]) { this.thread.frames = v; }
    get stack(): Sym[] { return this.thread.stack; }
    set stack(v: Sym[]) { this.thread.stack = v; }
    get depth(): number { return this.frames.length - 1; }
    get frame(): Frame { return this.frames[this.frames.length - 1]; }
    /** Thread positions and WRAM at the previous tick boundary (scheduler.ts newTick). */
    lastTickKey = '';

    /** Next thread uid. */
    nextUid = 1;

    /** The slot that names the current thread (its first script's). */
    get threadSlot(): number { return this.frames[0].slot; }

    /** The first slot no thread holds — the game's allocator ($8C:CF18) takes the lowest free one. */
    allocSlot(): number {
        const used = new Set<number>();
        for (const t of this.threads) for (const f of t.frames) used.add(f.slot);
        for (let i = 0; i < SLOT_COUNT; i++) if (!used.has(SLOT_BASE + i * SLOT_SIZE)) return SLOT_BASE + i * SLOT_SIZE;
        return -1;
    }

    clone(): PathState {
        const p = new PathState(0, this.mem.clone(), '');
        p.threads = this.threads.map((t) => ({ ...t, frames: t.frames.map((f) => ({ ...f, args: new Map(f.args) })), stack: [...t.stack] }));
        p.cur = this.cur;
        p.clock = this.clock.clone();
        p.turnOver = this.turnOver;
        p.threadDone = this.threadDone;
        p.tickActive = this.tickActive;
        p.readTimer = this.readTimer;
        p.ticks = this.ticks;
        p.nextUid = this.nextUid;
        p.lastTickKey = this.lastTickKey;
        p.turnTime = this.turnTime;
        p.resumeCur = this.resumeCur;
        p.turnReadTimer = this.turnReadTimer;
        p.rngUnknown = this.rngUnknown;
        p.visualOf = this.visualOf;
        p.sharedNodes = this.sharedNodes;
        p.opts = this.opts;
        p.log = this.log ? [...this.log] : null;
        p.lastEntity = this.lastEntity;
        p.known = new Map(this.known);
        p.merged = this.merged;
        p.topTrail = this.topTrail;
        p.either = [...this.either];
        p.conds = new Map(this.conds);
        p.steps = [...this.steps];
        p.entities = this.entities.map((e) => ({ ...e, refs: [...e.refs] }));
        p.returnedToEntry = this.returnedToEntry;
        p.forks = [...this.forks];
        p.visited = new Set(this.visited);
        p.budget = this.budget;
        p.freshCount = this.freshCount;
        return p;
    }

    /** An unknown that is new every time — a timer, a random draw, a choice. */
    fresh(name: string): Sym {
        this.freshCount++;
        return { k: 'atom', name: `${name}⟨${this.freshCount}⟩`, volatile: true };
    }

    /** True/false when the condition is constant or already assumed, else null. */
    decide(cond: Sym): boolean | null {
        const t = truthy(cond);
        if (isC(t)) return t.v !== 0;
        const k = key(t);
        if (this.known.has(k)) return this.known.get(k)!;
        const nk = key(not(t));
        if (this.known.has(nk)) return !this.known.get(nk)!;
        // `x == a` is false once `x == b` holds for a different constant b.
        if (t.k === 'bin' && t.op === '==' && isC(t.b)) {
            for (const [other, v] of this.known) {
                if (v && other.startsWith(`(${key(t.a)} == `) && other !== k) return false;
            }
        }
        return null;
    }

    assume(cond: Sym, value: boolean): void {
        const t = truthy(cond);
        this.known.set(key(t), value);
        this.conds.set(key(t), t);
    }

    /** Still assumed (not dropped by a merge)? */
    holds(cond: Sym): boolean {
        return this.known.has(key(truthy(cond)));
    }

    /**
     * What decides this path's future: position, WRAM, placed entities and
     * the conditions the entry script itself tested. Two paths with the same
     * key can only differ in choices a helper made that left no trace.
     */
    mergeKey(): string {
        const vis = this.visualOf ?? undefined;
        const main = this.liveTimes().slice(0, 1 + this.threads.filter((t) => !vis?.(t) && t.wait.k !== 'run').length);
        return [this.cur, this.threadsKey(vis), this.clock.shape(main), this.mem.fingerprint(), this.rngUnknown, key(this.lastEntity),
            this.entities.map((e) => `${e.label}@${e.refs.join(',')}`).join('|'), this.topTrail].join('#');
    }

    /** The time points the future can still depend on: now and every pending wake. */
    liveTimes(): TimePoint[] {
        const out: TimePoint[] = [this.clock.now];
        for (const t of this.waitOrder()) {
            if (t.wait.k === 'sleep') out.push(t.wait.until);
            if (t.wait.k === 'engine') out.push({ base: t.wait.event, off: 0 });
        }
        return out;
    }

    /** Threads in the order their waits are listed: the ones that matter first, visual ones last. */
    private waitOrder(): Thread[] {
        const vis = this.visualOf;
        return vis ? [...this.threads.filter((t) => !vis(t)), ...this.threads.filter((t) => vis(t))] : this.threads;
    }

    /**
     * Forget events nothing waits for any more (explore.ts calls this between
     * turns): the clock keeps only bounds between now and the pending wakes,
     * renumbered in a fixed order — so two paths that reached the same state
     * by different orders of finished events line up and can merge.
     */
    compactClock(): void {
        const pts = this.liveTimes();
        if (this.turnTime) pts.push(this.turnTime);
        // Any pending wake at an unknown moment: `now` is kept as bounds too, so a
        // state reached at tick 38 and the same state reached somewhere in 39..43 merge.
        const symbolic = pts.some((p) => p.base >= 0);
        const { clock, points } = this.clock.project(pts, symbolic);
        this.clock = clock;
        let i = 1;
        const vis = this.visualOf;
        let shared = -1;
        for (const t of this.waitOrder()) {
            if (vis?.(t) && shared < 0) shared = Math.max(-1, ...points.slice(0, i).map((p) => p.base)) + 1;
            if (t.wait.k === 'sleep') t.wait = { k: 'sleep', until: points[i++] };
            else if (t.wait.k === 'engine') t.wait = { ...t.wait, event: points[i++].base };
        }
        this.sharedNodes = shared < 0 ? clock.events.length : shared;
        if (this.turnTime) this.turnTime = points[i];
    }

    /**
     * Every thread's position, call stack, operand stack and wait. With
     * `visual` (room analysis), a thread that can only animate entities is
     * keyed by where it started, not by where it is (see reach.ts).
     */
    threadsKey(visual?: (t: Thread) => boolean): string {
        return this.threads.map((t) => visual?.(t) ? `visual:${t.frames[0].entry}` : [t.pc, t.frames.map((f) => `${f.entry}:${f.ret}:${f.slot}`).join('/'),
            t.stack.map(key).join(','), t.wait.k === 'run' ? 'r'
                : t.wait.k === 'sleep' ? `s${t.wait.until.base < 0 ? 't' : 'e'}+${t.wait.until.off}` : `e:${t.wait.what}`].join(' ')).join(' | ');
    }

    /** Depth-0 decisions so far, kept as a string so merge keys need no trace scan. */
    topTrail = '';

    /** Absorb a path with the same merge key: keep only assumptions both made alike. */
    absorb(o: PathState): void {
        this.visited = new Set([...this.visited, ...o.visited]);
        // Same state; the clocks may know different things about the order of what is pending.
        this.clock = this.clock.join(o.clock, Math.min(this.sharedNodes, o.sharedNodes));
        for (const [k, v] of [...this.known]) {
            if (o.known.get(k) === v) continue;
            this.known.delete(k);
            const c = this.conds.get(k);
            if (c && this.either.length < 64 && !this.either.some((e) => key(e) === k)) this.either.push(c);
        }
        for (const e of o.either) if (this.either.length < 64 && !this.either.some((x) => key(x) === key(e))) this.either.push(e);
        this.merged += o.merged;
    }

    /**
     * Rejoin with a path that split from this one at a depth-0 decision and
     * reached the same instruction. Returns null when the two cannot be
     * expressed as one `if` (different stacks, or they did not split on a
     * decision) — the caller then keeps them apart.
     */
    rejoin(o: PathState): PathState | null {
        if (o.cur !== this.cur || o.pc !== this.pc || o.depth !== this.depth) return null;
        if (o.threadsKey() !== this.threadsKey() || o.clock.key() !== this.clock.key()) return null;
        // Shared history is shared by reference up to the split, never after: bisect.
        let n = 0, hi = Math.min(this.steps.length, o.steps.length);
        while (n < hi) { const mid = (n + hi + 1) >> 1; if (this.steps[mid - 1] === o.steps[mid - 1]) n = mid; else hi = mid - 1; }
        const a = this.steps[n], b = o.steps[n];
        if (!a || !b || a.kind !== 'decide' || b.kind !== 'decide' || a.at !== b.at || a.value === b.value) return null;
        const [t, f] = a.value ? [this, o] : [o, this];
        const cond = truthy(a.cond);
        const out = this.clone();
        out.mem = t.mem.merge(cond, f.mem);
        out.known = new Map();
        out.conds = new Map(this.conds);
        out.lastEntity = ite(cond, t.lastEntity, f.lastEntity);
        for (const [k, v] of this.known) if (o.known.get(k) === v) out.known.set(k, v);
        out.steps = [...this.steps.slice(0, n), {
            kind: 'branch', at: a.at, depth: a.depth, cond, src: a.src, summary: a.summary,
            then: t.steps.slice(n + 1), else: f.steps.slice(n + 1),
        }];
        const byId = new Map<number, SimEntity>();
        for (const e of t.entities) byId.set(e.id, { ...e, refs: [...e.refs], when: f.entities.some((x) => x.id === e.id) ? e.when : bin('&&', e.when, cond) });
        for (const e of f.entities) if (!byId.has(e.id)) byId.set(e.id, { ...e, refs: [...e.refs], when: bin('&&', e.when, not(cond)) });
        out.entities = [...byId.values()];
        out.visited = new Set([...this.visited, ...o.visited]);
        out.budget = Math.max(this.budget, o.budget);
        out.merged = this.merged + o.merged;
        out.freshCount = Math.max(this.freshCount, o.freshCount);
        out.forks = [...this.forks];
        out.topTrail = this.steps.slice(0, n).filter((x) => x.kind === 'decide' && x.depth === 0)
            .map((x) => x.kind === 'decide' ? `${x.at}:${x.value} ` : '').join('') + `${a.at}:* `;
        return out;
    }

    /** The last map change this path made, for telling endings apart. */
    lastMap(): string {
        for (let i = this.steps.length - 1; i >= 0; i--) {
            const st = this.steps[i];
            if (st.kind === 'event' && st.event.type === 'map') return `${st.event.mapId}@${st.event.x},${st.event.y}`;
        }
        return '';
    }

    event(e: SimEvent): void {
        if (e.type !== 'wait' && e.type !== 'wake') this.tickActive = true;
        this.steps.push({ kind: 'event', event: e });
    }

    /** When the current turn really happens. */
    get turnNow(): TimePoint { return this.turnTime ?? this.clock.now; }

    /** The current tick as text, for events. */
    get time(): string { return this.clock.render(this.turnNow); }
}

export { c };
