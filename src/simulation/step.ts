// Ownership: executing one instruction on one path. Pure.
//
// Only instructions whose *meaning* the simulation needs are executed: flow,
// calls, the variable writes, object state, placements. Each of those reads
// its operands with operand.ts and must land exactly on the decoder's
// instruction boundary — if it does not, the layout here is wrong, the
// instruction is recorded in `Machine.layoutErrors`, and it runs as opaque
// instead of desyncing the path. Everything else is an opaque event: it
// happens, its text is kept, and the report says it was not modelled.

import { Sym, c, key, entityOf } from './sym';
import { SAVE_BASE, TEMP_BASE, flagAddr } from './memory';
import { evalOperand, EvalContext, Operand } from './operand';
import { Machine, Instruction } from './machine';
import { PathState, SimEvent } from './state';

const MAX_DEPTH = 24;
const MAX_STEPS = 20000;
const ASYNC_CALLS = new Set([0x07, 0xb4]);
const WAITS = new Set([0x2e, 0x38, 0x39, 0x3a, 0x3b, 0xa7, 0xa8]);
const TEXT = new Set([0x50, 0x51, 0x52]);
/** Tail bytes after the argument operands of the call-with-arguments family. */
const CALL_TAIL: Record<number, number> = { 0xaf: 3, 0xb4: 3, 0xb2: 1, 0xb3: 2, 0xb0: 1, 0xb1: 2 };

type Base = { at: number; depth: number; opcode: number; summary: string };

export function context(s: PathState): EvalContext {
    return {
        mem: s.mem,
        stack: s.stack,
        arg: (i) => s.frame.args.get(i) ?? { k: 'atom', name: `${s.frame.name} arg${i}`, volatile: false },
        lastEntity: s.lastEntity,
        owner: { k: 'atom', name: 'script owner', volatile: false },
        fresh: (n) => s.fresh(n),
    };
}

/** Advance `s` by one instruction. Returns the paths that continue (0, 1 or 2). */
export function step(m: Machine, s: PathState): PathState[] {
    if (++s.budget > MAX_STEPS) { s.end = 'budget'; return []; }
    const ins = m.instruction(s.pc);
    if (!ins) { s.end = 'undecodable'; return []; }
    const base: Base = { at: ins.address, depth: s.depth, opcode: ins.opcode, summary: resolveText(ins.summary, s) };
    const ctx = context(s);
    const op = (at: number): Operand => evalOperand(m.rom, at, m.toFile, ctx);
    const next = s.pc + ins.size;
    const fits = (len: number): boolean => {
        if (len === ins.size) return true;
        m.layoutErrors.set(ins.address, { opcode: ins.opcode, ours: len, decoder: ins.size });
        return false;
    };
    const branch = ins.effects.find((e) => e.kind === 'branch')?.target as number | undefined;

    switch (ins.opcode) {
        case 0x00: return ret(s);
        case 0x04: case 0x05: return goTo(s, branch ?? next);
        case 0x08: case 0x09: {
            const o = op(s.pc + 1);
            if (!fits(1 + o.length + 2) || branch === undefined) break;
            const jumpWhen = ins.opcode === 0x08;
            return fork(s, o.value, o.src, base, (p, v) => goTo(p, v === jumpWhen ? branch : next));
        }
        case 0x0a: case 0x0b: case 0x8e: case 0x8f: {
            if (branch === undefined) break;
            // A currency comparison: modelled as an unknown named by its site.
            const cond: Sym = { k: 'atom', name: `[${ins.summary.replace(/ THEN SKIP.*| SKIP.*/, '')}]`, volatile: false };
            return fork(s, cond, key(cond), base, (p, v) => goTo(p, v ? branch : next));
        }
        case 0x0c: case 0x0d: {
            const code = m.u16(s.pc + 1);
            const o = op(s.pc + 3);
            if (!fits(3 + o.length)) break;
            const f = flagAddr(code, ins.opcode === 0x0c ? SAVE_BASE : TEMP_BASE);
            s.mem.writeBit(f.addr, f.bit, o.value);
            s.event({ ...base, type: 'flag', addr: f.addr, bit: f.bit, value: s.mem.readBit(f.addr, f.bit), src: o.src });
            return [advance(s, next)];
        }
        case 0x10: case 0x14: case 0x11: case 0x18: case 0x1c: case 0x19: case 0x1d: {
            const temp = ins.opcode === 0x11 || ins.opcode === 0x19 || ins.opcode === 0x1d;
            const size: 1 | 2 = ins.opcode === 0x10 || ins.opcode === 0x14 || ins.opcode === 0x11 ? 1 : 2;
            const addr = (m.u16(s.pc + 1) + (temp ? TEMP_BASE : SAVE_BASE)) & 0xffff;
            const o = op(s.pc + 3);
            if (!fits(3 + o.length)) break;
            write(s, base, addr, size, o.value, o.src);
            return [advance(s, next)];
        }
        case 0x17: {
            if (!fits(5)) break;
            const v = m.u16(s.pc + 3);
            write(s, base, (m.u16(s.pc + 1) + SAVE_BASE) & 0xffff, 2, c(v), '0x' + v.toString(16).padStart(4, '0'));
            return [advance(s, next)];
        }
        case 0x1b: {
            if (!fits(7)) break;
            for (const i of [0, 1]) {
                const v = m.u8(s.pc + 5 + i) * 8;
                write(s, base, (m.u16(s.pc + 1 + 2 * i) + SAVE_BASE) & 0xffff, 2, c(v), String(v));
            }
            return [advance(s, next)];
        }
        case 0x1a: case 0x1e: {
            const o = op(s.pc + 2);
            if (!fits(2 + o.length)) break;
            s.frame.args.set(m.u8(s.pc + 1), o.value);
            s.event({ ...base, type: 'opaque' });
            return [advance(s, next)];
        }
        case 0x7a: {
            const p = op(s.pc + 1);
            const v = op(s.pc + 1 + p.length);
            if (!fits(1 + p.length + v.length)) break;
            if (p.value.k === 'c') write(s, base, p.value.v, 2, v.value, v.src);
            else s.event({ ...base, type: 'opaque' });
            return [advance(s, next)];
        }
        case 0x5c: {
            const i = op(s.pc + 1);
            const v = op(s.pc + 1 + i.length);
            if (!fits(1 + i.length + v.length)) break;
            s.event({ ...base, type: 'object', index: i.value, value: v.value, when: c(1) });
            return [advance(s, next)];
        }
        case 0x5d: {
            const i = op(s.pc + 1);
            if (!fits(1 + i.length + 2)) break;
            const f = flagAddr(m.u16(s.pc + 1 + i.length), SAVE_BASE);
            s.event({ ...base, type: 'object', index: i.value, value: c(0), when: s.mem.readBit(f.addr, f.bit) });
            return [advance(s, next)];
        }
        default: break;
    }
    return generic(m, s, ins, base, next, op);
}

/** Calls, placements, map changes, music, text, waits — and the opaque rest. */
function generic(m: Machine, s: PathState, ins: Instruction, base: Base, next: number, op: (a: number) => Operand): PathState[] {
    const call = ins.effects.find((e) => e.kind === 'call')?.target as number | undefined;
    const global = ins.effects.find((e) => e.kind === 'callGlobal')?.id as number | undefined;
    let target: number | null = call ?? (global !== undefined ? m.globalScript(global) : null);
    let args: Sym[] = [];
    if (target === null && (ins.opcode === 0xa4 || CALL_TAIL[ins.opcode] !== undefined)) {
        const t = /(?:-> |script )0x([0-9a-f]{6})/.exec(ins.summary);
        target = t ? parseInt(t[1], 16) : null;
        if (CALL_TAIL[ins.opcode] !== undefined) {
            let pos = s.pc + 2;
            for (let i = 0; i < m.u8(s.pc + 1); i++) { const o = op(pos); args.push(o.value); pos += o.length; }
            if (pos + CALL_TAIL[ins.opcode] !== next) {
                m.layoutErrors.set(ins.address, { opcode: ins.opcode, ours: pos + CALL_TAIL[ins.opcode] - s.pc, decoder: ins.size });
                args = [];
            }
        }
    }
    if (target !== null) {
        const name = global !== undefined ? m.dec.globalScriptName(global) : m.dec.absScriptName(m.toFile(target), `script ${target.toString(16)}`);
        const isAsync = ASYNC_CALLS.has(ins.opcode);
        s.event({ ...base, type: 'call', target, name, async: isAsync, args, global: global ?? null });
        if (isAsync) return [advance(s, next)];
        if (s.depth >= MAX_DEPTH) { s.end = 'depth'; return []; }
        // A script calling itself (the debug menu does) would fork without end.
        if (s.frames.some((f) => f.entry === target)) { s.end = 'recursion'; return []; }
        s.frames.push({ ret: next, entry: target, args: new Map(args.map((a, i) => [2 * i, a])), name });
        s.pc = target;
        return [s];
    }
    for (const e of ins.effects) {
        if (e.kind === 'spawn') {
            const f = m.dec.extractSpawns([ins])[0];
            const again = s.entities.filter((x) => x.at === ins.address).length;
            const id = ins.address * 16 + again;
            const label = `${f?.romName ?? f?.name ?? 'npc 0x' + (e.npc as number).toString(16)}#${(ins.address & 0xffff).toString(16)}${again ? '.' + again : ''}`;
            s.entities.push({ id, label, npc: e.npc as number, x: f?.x ?? null, y: f?.y ?? null, at: ins.address, refs: [], when: c(1) });
            s.lastEntity = { k: 'ent', id, label };
            s.event({ ...base, type: 'spawn', entity: id, label });
            return [advance(s, next)];
        }
        if (e.kind === 'changeMap') {
            s.event({ ...base, type: 'map', mapId: e.mapId as number, x: e.x as number, y: e.y as number });
            return [advance(s, next)];
        }
        if (e.kind === 'playMusic') {
            s.event({ ...base, type: 'music', track: e.track as number });
            return [advance(s, next)];
        }
    }
    if (TEXT.has(ins.opcode)) s.event({ ...base, type: 'text' });
    else if (WAITS.has(ins.opcode)) s.event({ ...base, type: 'wait' });
    else s.event({ ...base, type: 'opaque' });
    if (ins.terminal) { s.end = 'end'; return []; }
    return [advance(s, next)];
}

function write(s: PathState, base: Base, addr: number, size: 1 | 2, value: Sym, src: string): void {
    if (size === 1) s.mem.writeByte(addr, value); else s.mem.writeWord(addr, value);
    const ent = entityOf(value);
    for (const e of s.entities) {
        const i = e.refs.indexOf(addr);
        if (i >= 0 && (!ent || ent.id !== e.id)) e.refs.splice(i, 1);
    }
    const placed = ent && s.entities.find((e) => e.id === ent.id);
    if (placed && !placed.refs.includes(addr)) placed.refs.push(addr);
    s.event({ ...base, type: 'write', addr, size, value: size === 1 ? s.mem.readByte(addr) : s.mem.readWord(addr), src });
}

function advance(s: PathState, next: number): PathState { s.pc = next; return s; }

/** A jump. Going back to an address this frame already passed is a loop: the path ends there. */
function goTo(s: PathState, target: number): PathState[] {
    if (target <= s.pc) {
        const k = `${s.depth}:${s.frame.entry}:${target}`;
        if (s.visited.has(k)) { s.end = 'loop'; return []; }
        s.visited.add(k);
    }
    s.pc = target;
    return [s];
}

function ret(s: PathState): PathState[] {
    const f = s.frames.pop()!;
    if (f.ret === null || s.frames.length === 0) { s.end = 'end'; return []; }
    s.pc = f.ret;
    if (s.frames.length === 1) s.returnedToEntry = true;
    return [s];
}

/** Decide `cond`, or split the path in two and let each assume one answer. */
function fork(s: PathState, cond: Sym, src: string, base: Base, apply: (p: PathState, v: boolean) => PathState[]): PathState[] {
    const known = s.decide(cond);
    const record = (p: PathState, v: boolean): void => {
        p.steps.push({ kind: 'decide', at: base.at, depth: base.depth, cond, src, value: v, summary: base.summary });
        if (base.depth === 0) p.topTrail += `${base.at}:${v} `;
    };
    if (known !== null) { record(s, known); return apply(s, known); }
    const t = s.clone();
    t.assume(cond, true); record(t, true);
    s.assume(cond, false); record(s, false);
    return [...apply(t, true), ...apply(s, false)];
}

/** Opaque summaries name entities by RAM; say which placed NPC lives there. */
function resolveText(summary: string, s: PathState): string {
    let out = summary;
    if (s.lastEntity.k === 'ent') out = out.replace(/last entity \(\$0341\)/g, s.lastEntity.label);
    return out.replace(/\$([0-9a-f]{4})\b/g, (all, h: string) => {
        const a = parseInt(h, 16);
        const e = s.entities.find((x) => x.refs.includes(a));
        return e ? `${e.label}(${all})` : all;
    });
}

export type { SimEvent };
