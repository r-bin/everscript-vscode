// Ownership: a script as one listing with what it calls merged in — read the way the interpreter
// runs it (docs/scripts/vm.md, "Flow"). Pure.
//
// When each runs is the scheduler's (knowledge rom/8ccffd.md): a call puts the callee in the
// caller's place in the same pass, so its body follows the call line. A start (`call_async`)
// appends a thread to the run list and the starter carries on; the new thread first runs once the
// starter's turn is over, so its body follows the next line that ends the turn — a sleep, a
// yield, a wait — even inside a callee, or the end of the starter's thread. A call does not end
// the turn, and neither does the end of a called script (the caller resumes in the same pass).
//
// Each script reads as structured code (structure.ts): `if (…) { } else if (…) { } else { }` and
// `while (…) { }` recovered from its branches and jumps, the lines indented by them. A called body
// sits as deep as its call line (the call is a fold, not a block of its own); a started thread's
// sits one deeper. `flat` is the indent without the structured listing, for a viewer that shows
// the instructions as printed (`raw`, no braces).
//
// Each merged body is a block the viewer can fold. A callee named by a short operand — a global id
// (u8), a trigger offset (u16), a call back (cb, c16) — is a shared helper and starts folded; one
// named by a full pointer (u24) starts open. A callee already being merged further up is not merged
// again (recursion), and the listing stops merging past MAX_LINES, so nothing here can run away.

import { Instruction, Names, ScriptRom, decodeAt, roomScripts, walk } from '../script-vm';
import { ScriptRow, row } from './room-model';
import { printNames, displayNames } from './names';
import { structure } from './structure';
import { hiromFileOffset } from '../../../platform/snes/hirom';

/** Past this many lines no more bodies are merged in. */
const MAX_LINES = 4000;

export interface MergedLine extends ScriptRow {
    /** The block this line belongs to (innermost), -1 for the script itself. */
    in: number;
    /** How deep to draw it: the ifs and loops around it in its script, plus where its block sits. */
    indent: number;
    /** How deep to draw it without the structured listing: only the threads it runs in. */
    flat: number;
    /** The block this line heads: a call's body, or a started thread's. */
    opens?: number;
    /** A line that is not an instruction: where a thread joins, why a body is not merged. */
    note?: boolean;
    /** A brace of the structured listing (`}`, `while (true) {`): no instruction of its own. */
    brace?: boolean;
    /** The instruction as printed, when the structured listing says it differently (`if (c) {` for `if! (c) goto …`). */
    raw?: string;
}

export interface MergedBlock {
    id: number;
    parent: number;
    kind: 'call' | 'thread';
    /** The script merged in. */
    target: number;
    /** Where it was called or started from. */
    from: number;
    /** Starts folded: a shared helper (named by an id, an offset or a call back). */
    folded: boolean;
    /** How many lines it holds, its own blocks' included. */
    size: number;
}

export interface MergedScript { entry: number; lines: MergedLine[]; blocks: MergedBlock[] }


/** The script at `entry`, with every call and start merged in. */
export function mergedScript(rom: ScriptRom, entry: number, names: Names = printNames(hiromFileOffset)): MergedScript {
    const lines: MergedLine[] = [];
    const blocks: MergedBlock[] = [];

    /** How deep a script's lines sit: structured (`s`) and flat (`f`). */
    type Base = { s: number; f: number };
    const deeper = (b: Base): Base => ({ s: b.s + 1, f: b.f + 1 });
    const note = (at: number, depth: number, at2: Base, block: number, summary: string): MergedLine => ({
        addressSnes: at, opcode: -1, opcodeHex: '', size: 0, bytesHex: '', summary, terminal: false, untraced: false,
        unsupported: false, depth, indent: at2.s, flat: at2.f, in: block, note: true,
    });

    function open(kind: MergedBlock['kind'], ins: Instruction, parent: number): MergedBlock {
        const last = ins.operands[ins.operands.length - 1];
        const b: MergedBlock = { id: blocks.length, parent, kind, target: ins.target!, from: ins.address, folded: kind === 'call' && last?.k !== 'u24', size: 0 };
        blocks.push(b);
        return b;
    }

    /**
     * One script's lines at `depth`, inside `block`; `stack` the scripts being merged above it.
     * `waiting` is the thread's starts that have not had a turn yet: shared with the scripts it
     * calls (same thread), joined in where the turn ends.
     */
    function body(at: number, depth: number, base: Base, block: number, stack: number[], waiting: Instruction[]): void {
        const list = [...walk(rom, [at], false).instructions.values()].sort((a, b) => a.address - b.address);
        const printed = list.map((ins) => row(rom, ins, names));
        let here = base;
        const join = (): void => {
            for (const s of waiting.splice(0)) {
                const b = open('thread', s, block);
                const head = note(s.address, depth, here, block, `∥ thread $${hex6(s.target!)} runs alongside from here (started at $${hex6(s.address)})`);
                head.opens = b.id;
                lines.push(head);
                merge(b, s.target!, depth + 1, deeper(here), stack, []);
            }
        };
        for (const r of structure(list, printed.map((p) => p.summary))) {
            here = { s: base.s + r.depth, f: base.f };
            if (r.kind === 'brace') {
                lines.push({ ...note(-1, depth, here, block, r.text), note: false, brace: true });
                continue;
            }
            const ins = list[r.index];
            const line: MergedLine = { ...printed[r.index], depth, indent: here.s, flat: here.f, in: block };
            if (r.text !== undefined) { line.raw = line.summary; line.summary = r.text; }
            lines.push(line);
            if (ins.flow === 'call' && ins.target !== null && rom.contains(ins.target)) {
                const b = open('call', ins, block);
                lines[lines.length - 1].opens = b.id;
                merge(b, ins.target, depth + 1, here, stack, waiting);
            }
            if (ins.flow === 'start' && ins.target !== null && rom.contains(ins.target)) waiting.push(ins);
            if (ins.flow === 'yield') join();
        }
    }

    /** Merge `target` into block `b`; a thread's own body ends its turn, so what it started joins at its end. */
    function merge(b: MergedBlock, target: number, depth: number, base: Base, stack: number[], waiting: Instruction[]): void {
        const start = lines.length;
        if (stack.includes(target)) lines.push(note(target, depth, base, b.id, `↻ $${hex6(target)} is already running above: not merged again`));
        else if (lines.length > MAX_LINES) lines.push(note(target, depth, base, b.id, `… $${hex6(target)} not merged: the listing is long enough`));
        else body(target, depth, base, b.id, [...stack, target], waiting);
        if (b.kind === 'thread') joinAtEnd(waiting, depth, base, b.id, stack);
        b.size = lines.length - start;
    }

    /** What a thread started and never yielded after runs once the thread is over. */
    function joinAtEnd(waiting: Instruction[], depth: number, base: Base, block: number, stack: number[]): void {
        for (const s of waiting.splice(0)) {
            const b = open('thread', s, block);
            const head = note(s.address, depth, base, block, `∥ thread $${hex6(s.target!)} runs from here, after the thread that started it (at $${hex6(s.address)})`);
            head.opens = b.id;
            lines.push(head);
            merge(b, s.target!, depth + 1, deeper(base), stack, []);
        }
    }

    if (rom.contains(entry)) {
        try {
            decodeAt(rom, entry);
            const waiting: Instruction[] = [];
            body(entry, 0, { s: 0, f: 0 }, -1, [entry], waiting);
            joinAtEnd(waiting, 0, { s: 0, f: 0 }, -1, [entry]);
        } catch { /* an undecodable entry: no lines */ }
    }
    return { entry, lines, blocks };
}

/** ROM room `mapId`'s enter script, merged; null when it has none. */
export function mergedEnterScript(bytes: Uint8Array, mapId: number): MergedScript | null {
    const rom = new ScriptRom(bytes);
    const entry = roomScripts(rom, mapId).enter;
    // For reading: names from the knowledge entries too, where the compiler's have none.
    return entry === null ? null : mergedScript(rom, entry, displayNames(hiromFileOffset));
}

const hex6 = (v: number): string => v.toString(16).padStart(6, '0');
