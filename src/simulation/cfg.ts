// Ownership: the entry script's control-flow graph and where its branches
// join again. Pure.
//
// The join of a conditional is its immediate post-dominator: the first
// instruction every way out of it must pass. Paths that split at a branch
// wait there for each other and merge, so an `if` that only adds an NPC costs
// one merged path instead of doubling every path after it. A branch whose
// sides never meet again (one ends the script) has no join.
//
// Calls are single nodes: the simulation runs a call to completion and merges
// what comes back at the return address itself.

import { Machine } from './machine';

const CONDITIONAL = new Set([0x08, 0x09, 0x0a, 0x0b, 0x8e, 0x8f]);
const JUMP = new Set([0x04, 0x05]);
const EXIT = -1;
const MAX_NODES = 4096;

/** Successors of every instruction reachable from `entry`, without entering calls. */
export function controlFlow(m: Machine, entry: number): Map<number, number[]> {
    const succ = new Map<number, number[]>();
    const todo = [entry];
    while (todo.length && succ.size < MAX_NODES) {
        const a = todo.pop()!;
        if (succ.has(a)) continue;
        const ins = m.instruction(a);
        if (!ins) { succ.set(a, [EXIT]); continue; }
        const target = ins.effects.find((e) => e.kind === 'branch')?.target as number | undefined;
        const next = a + ins.size;
        let out: number[];
        if (ins.opcode === 0x00 || ins.terminal) out = [EXIT];
        else if (JUMP.has(ins.opcode)) out = target !== undefined ? [target] : [EXIT];
        else if (CONDITIONAL.has(ins.opcode) && target !== undefined) out = [next, target];
        else out = [next];
        succ.set(a, out);
        for (const s of out) if (s !== EXIT && !succ.has(s)) todo.push(s);
    }
    return succ;
}

/**
 * Immediate post-dominator of every conditional, or null when its sides only
 * meet at the script's end. Classic iterative dataflow on the reversed graph —
 * the graphs are a few hundred instructions.
 */
export function joinPoints(m: Machine, entry: number): Map<number, number | null> {
    const succ = controlFlow(m, entry);
    const nodes = [...succ.keys()];
    const all = new Set<number>([...nodes, EXIT]);
    const pdom = new Map<number, Set<number>>();
    for (const n of nodes) pdom.set(n, new Set(all));
    pdom.set(EXIT, new Set([EXIT]));
    let changed = true;
    while (changed) {
        changed = false;
        for (const n of nodes) {
            const ss = succ.get(n)!;
            let inter: number[] | null = null;
            for (const s of ss) {
                const ps: Set<number> = pdom.get(s) ?? new Set([s, EXIT]);
                inter = inter === null ? [...ps] : inter.filter((x) => ps.has(x));
            }
            const next = new Set<number>(inter ?? []);
            next.add(n);
            if (next.size !== pdom.get(n)!.size) { pdom.set(n, next); changed = true; }
        }
    }
    const joins = new Map<number, number | null>();
    for (const n of nodes) {
        const ins = m.instruction(n);
        if (!ins || !CONDITIONAL.has(ins.opcode)) continue;
        // The immediate one is the strict post-dominator every other one post-dominates.
        const strict = [...pdom.get(n)!].filter((x) => x !== n);
        const ipdom = strict.find((d) => strict.every((o) => o === d || (pdom.get(d)?.has(o) ?? o === EXIT)));
        joins.set(n, ipdom === undefined || ipdom === EXIT ? null : ipdom);
    }
    return joins;
}
