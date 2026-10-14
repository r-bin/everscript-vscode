// Ownership: one simulated path — where it is, what it knows, what it did.
// Pure.
//
// A path forks when a condition depends on something the model does not know
// (simulation/virtual-wram.md: "undecided is a result"). Each fork records the
// condition and which way this path went; a later test of the same condition
// is then *decided*, so a path never holds a flag both set and clear.

import { Sym, c, key, not, isC, truthy, ite, bin } from './sym';
import { Memory } from './memory';

export interface Frame {
    /** Where the caller resumes, or null for the entry script. */
    ret: number | null;
    entry: number;
    args: Map<number, Sym>;
    name: string;
}

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

/** Something a path did. `depth` 0 is the entry script, 1+ inside calls. */
export type SimEvent = { at: number; depth: number; opcode: number; summary: string } & (
    | { type: 'write'; addr: number; size: 1 | 2; value: Sym; src: string }
    | { type: 'flag'; addr: number; bit: number; value: Sym; src: string }
    | { type: 'call'; target: number; name: string; async: boolean; args: Sym[]; global: number | null }
    | { type: 'spawn'; entity: number; label: string }
    | { type: 'map'; mapId: number; x: number; y: number }
    | { type: 'music'; track: number }
    | { type: 'text' }
    | { type: 'object'; index: Sym; value: Sym; when: Sym }
    | { type: 'wait' }
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

export type EndReason = 'end' | 'loop' | 'recursion' | 'undecodable' | 'budget' | 'depth' | 'fork-cap';

export class PathState {
    pc: number;
    frames: Frame[];
    mem: Memory;
    stack: Sym[] = [];
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
        this.pc = entry;
        this.frames = [{ ret: null, entry, args: new Map(), name }];
        this.mem = mem;
        this.lastEntity = { k: 'atom', name: 'last entity', volatile: false };
    }

    get depth(): number { return this.frames.length - 1; }
    get frame(): Frame { return this.frames[this.frames.length - 1]; }

    clone(): PathState {
        const p = new PathState(this.pc, this.mem.clone(), '');
        p.frames = this.frames.map((f) => ({ ...f, args: new Map(f.args) }));
        p.stack = [...this.stack];
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
        return { k: 'atom', name: `${name}#${this.freshCount}`, volatile: true };
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
        return [this.pc, this.depth, this.mem.fingerprint(), key(this.lastEntity),
            this.entities.map((e) => `${e.label}@${e.refs.join(',')}`).join('|'),
            this.stack.map(key).join(','), this.topTrail].join('#');
    }

    /** Depth-0 decisions so far, kept as a string so merge keys need no trace scan. */
    topTrail = '';

    /** Absorb a path with the same merge key: keep only assumptions both made alike. */
    absorb(o: PathState): void {
        this.visited = new Set([...this.visited, ...o.visited]);
        for (const [k, v] of [...this.known]) {
            if (o.known.get(k) === v) continue;
            this.known.delete(k);
            const c = this.conds.get(k);
            if (c && !this.either.some((e) => key(e) === k)) this.either.push(c);
        }
        for (const e of o.either) if (!this.either.some((x) => key(x) === key(e))) this.either.push(e);
        this.merged += o.merged;
    }

    /**
     * Rejoin with a path that split from this one at a depth-0 decision and
     * reached the same instruction. Returns null when the two cannot be
     * expressed as one `if` (different stacks, or they did not split on a
     * decision) — the caller then keeps them apart.
     */
    rejoin(o: PathState): PathState | null {
        if (o.pc !== this.pc || o.depth !== this.depth) return null;
        if (o.frames.map((f) => `${f.entry}:${f.ret}`).join() !== this.frames.map((f) => `${f.entry}:${f.ret}`).join()) return null;
        if (o.stack.map(key).join() !== this.stack.map(key).join()) return null;
        let n = 0;
        while (n < this.steps.length && n < o.steps.length && this.steps[n] === o.steps[n]) n++;
        const a = this.steps[n], b = o.steps[n];
        if (!a || !b || a.kind !== 'decide' || b.kind !== 'decide' || a.at !== b.at || a.value === b.value) return null;
        const [t, f] = a.value ? [this, o] : [o, this];
        const cond = truthy(a.cond);
        const out = new PathState(this.pc, t.mem.merge(cond, f.mem), this.frame.name);
        out.frames = this.frames.map((fr) => ({ ...fr, args: new Map(fr.args) }));
        out.stack = [...this.stack];
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

    event(e: SimEvent): void {
        this.steps.push({ kind: 'event', event: e });
    }
}

export { c };
