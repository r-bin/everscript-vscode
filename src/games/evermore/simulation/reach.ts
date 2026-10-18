// Ownership: what a thread can ever do from where it is — a static scan of
// every instruction reachable from its pc, calls included. Pure.
//
// Used to recognise *visual* threads: ones that write no WRAM, start no
// thread, show no text and change no map — they only move, turn and animate
// entities. Their exact phase changes nothing a script can observe, so in
// room analysis (explore.ts, `abstractVisual`) paths that differ only in where
// such threads are merge. Exact runs (a replay with known durations) never do.

import { Machine } from './machine';

const WRITES = new Set([0x0c, 0x0d, 0x10, 0x11, 0x14, 0x15, 0x17, 0x18, 0x19, 0x1b, 0x1c, 0x1d, 0x7a, 0xad]);
const STARTS = new Set([0x07, 0xb4]);
/**
 * Opcodes that reach past the thread's entities: map change, reset, text and its windows
 * (handlers through $8C:C55D / $8C:D967, the records at $034D), sound and music, the PPU shadows
 * at $0106 (0x63, 0x7f), and the rest whose handlers are not read yet but were seen doing so.
 * Too many here only costs merges; too few would merge threads that matter.
 */
const GLOBAL = new Set([
    0x22, 0xab, 0x8c, 0x27, 0x30, 0x31, 0x32, 0x33, 0x44, 0x45, 0x46, 0x47, 0x50, 0x51, 0x52, 0x54, 0x55, 0x58, 0x59,
    0x5a, 0x5b, 0x63, 0x7f, 0x80, 0x81, 0x8d, 0x8e, 0x91, 0x96, 0x9f, 0xa0, 0xa1,
]);

export interface Reach { writes: boolean; starts: boolean; global: boolean }

const cache = new WeakMap<Machine, Map<number, Reach>>();

export function reach(m: Machine, pc: number): Reach {
    if (!cache.has(m)) cache.set(m, new Map());
    const c = cache.get(m)!;
    if (c.has(pc)) return c.get(pc)!;
    const out: Reach = { writes: false, starts: false, global: false };
    const seen = new Set<number>();
    const todo = [pc];
    while (todo.length && seen.size < 4096) {
        const a = todo.pop()!;
        if (seen.has(a)) continue;
        seen.add(a);
        const ins = m.instruction(a);
        if (!ins) { out.global = true; continue; }
        const op = ins.opcode;
        // Reading the random number generator advances it: a write.
        if (WRITES.has(op) || ins.effects.some((e) => e.kind === 'random')) out.writes = true;
        if (STARTS.has(op) || ins.effects.some((e) => e.kind === 'spawn')) out.starts = true;
        if (GLOBAL.has(op)) out.global = true;
        let call: number | undefined;
        for (const e of ins.effects) {
            if (e.kind === 'branch') todo.push(e.target);
            else if (e.kind === 'call') call = e.target;
            else if (e.kind === 'callGlobal') call = m.globalScript(e.id);
        }
        if (call !== undefined && !STARTS.has(op)) todo.push(call);
        if (op !== 0x00 && op !== 0x04 && op !== 0x05 && !ins.terminal) todo.push(a + ins.size);
    }
    if (todo.length) out.global = true; // too big to scan: assume the worst
    c.set(pc, out);
    return out;
}

/** Writes nothing scripts can see: only moves, turns and animates entities. */
export function isVisual(r: Reach): boolean {
    return !r.writes && !r.starts && !r.global;
}
