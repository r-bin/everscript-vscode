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
const GLOBAL = new Set([0x22, 0x50, 0x51, 0x52, 0xab, 0x8c, 0x7f, 0x63]);
const CALLS_WITH_TARGET = /(?:-> |script )0x([0-9a-f]{6})/;

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
        if (WRITES.has(op) || /RAND|random/i.test(ins.summary)) out.writes = true;
        if (STARTS.has(op) || ins.effects.some((e) => e.kind === 'spawn')) out.starts = true;
        if (GLOBAL.has(op) || /TEXT|message|CURRENCY|music|SOUND|screen|bright|fade/i.test(ins.summary)) out.global = true;
        const target = ins.effects.find((e) => e.kind === 'branch')?.target as number | undefined;
        if (target !== undefined) todo.push(target);
        const call = (ins.effects.find((e) => e.kind === 'call')?.target as number | undefined)
            ?? (ins.effects.some((e) => e.kind === 'callGlobal') ? m.globalScript(ins.effects.find((e) => e.kind === 'callGlobal')!.id as number) : undefined)
            ?? (CALLS_WITH_TARGET.exec(ins.summary) ? parseInt(CALLS_WITH_TARGET.exec(ins.summary)![1], 16) : undefined);
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
