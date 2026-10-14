// Ownership: a script as a neutral tree (what happens, under what condition)
// and as Everscript that compiles back to the same bytes. Pure.
//
// The tree comes from the script's own control flow: a forward IF whose body
// ends in a forward SKIP is an if/else, any other forward IF an if. That is
// exactly the shape the everscript compiler emits for `if(c) { } else { }`
// (opcode 0x09, or 0x08 for `if!`), so writing the tree back out gives the
// original bytes. Everything that is not flow is written as `code(...)` with
// its own bytes and a comment saying what it does — functionally identical by
// construction, and tests/simulation/everscript.test.js compiles the output
// with the sibling compiler to prove it.
//
// A script with flow this shape cannot hold (backward jumps, a SKIP into the
// middle of a branch, a condition with no exact Everscript spelling) is
// written entirely as raw `code(...)` — still identical, just not structured —
// and says so in `structured`.

import { Machine, Instruction } from './machine';
import { evalOperand } from './operand';
import { Memory } from './memory';

export type Neutral =
    | { kind: 'if'; at: number; negated: boolean; cond: string; then: Neutral[]; else: Neutral[] }
    | { kind: 'end'; at: number }
    | { kind: 'do'; at: number; bytes: number[]; summary: string; everscript: string | null };

export interface EmittedScript {
    entry: number;
    /** Bytes the script occupies, from entry to its last instruction. */
    length: number;
    tree: Neutral[];
    /** False when the flow could not be structured and the output is raw bytes. */
    structured: boolean;
    everscript: string;
}

class Unstructured extends Error {}

const hx = (v: number): string => '0x' + v.toString(16).padStart(2, '0');

/** Decompile the script at `entry` into a neutral tree and Everscript. */
export function emitScript(m: Machine, entry: number, name = `script_${entry.toString(16)}`): EmittedScript {
    const end = extent(m, entry);
    const bytes = (a: number, n: number): number[] => Array.from({ length: n }, (_, i) => m.u8(a + i));
    let tree: Neutral[];
    let structured = true;
    try {
        tree = block(m, entry, end, bytes);
    } catch (e) {
        if (!(e instanceof Unstructured)) throw e;
        structured = false;
        tree = [];
        for (let a = entry; a < end;) {
            const ins = m.instruction(a)!;
            tree.push({ kind: 'do', at: a, bytes: bytes(a, ins.size), summary: ins.summary, everscript: null });
            a += ins.size;
        }
    }
    const body = render(tree, '    ');
    return {
        entry, length: end - entry, tree, structured,
        everscript: `// ${structured ? 'Structured' : 'Raw'} decompile of $${entry.toString(16)}, ${end - entry} bytes.\n` +
            `fun ${name}() {\n${body}}\n`,
    };
}

/** One past the last byte of the last instruction the script can reach without calls. */
function extent(m: Machine, entry: number): number {
    const seen = new Set<number>();
    const todo = [entry];
    let end = entry;
    while (todo.length) {
        const a = todo.pop()!;
        if (seen.has(a) || seen.size > 4096) continue;
        seen.add(a);
        const ins = m.instruction(a);
        if (!ins) throw new Error(`undecodable at ${a.toString(16)}`);
        end = Math.max(end, a + ins.size);
        const target = ins.effects.find((e) => e.kind === 'branch')?.target as number | undefined;
        if (target !== undefined) todo.push(target);
        if (ins.opcode !== 0x00 && ins.opcode !== 0x04 && ins.opcode !== 0x05 && !ins.terminal) todo.push(a + ins.size);
    }
    // The walk must cover [entry, end) without holes, or the bytes in between are not this script's.
    for (let a = entry; a < end;) { const ins = m.instruction(a); if (!ins) throw new Error('hole'); a += ins.size; }
    return end;
}

function block(m: Machine, from: number, stop: number, bytes: (a: number, n: number) => number[]): Neutral[] {
    const out: Neutral[] = [];
    let pc = from;
    while (pc < stop) {
        const ins = m.instruction(pc)!;
        const next = pc + ins.size;
        const target = ins.effects.find((e) => e.kind === 'branch')?.target as number | undefined;
        if (ins.opcode === 0x00) { out.push({ kind: 'end', at: pc }); pc = next; continue; }
        if (ins.opcode === 0x08 || ins.opcode === 0x09) {
            if (target === undefined || target <= pc || target > stop) throw new Unstructured();
            const cond = condition(m, pc, ins);
            // A SKIP closing the then-side, forward and within this block, makes it an if/else.
            const last = lastBefore(m, next, target);
            const elseTo = last && last.opcode === 0x04 ? (last.effects.find((e) => e.kind === 'branch')?.target as number) : undefined;
            if (elseTo !== undefined && elseTo > target && elseTo <= stop) {
                out.push({ kind: 'if', at: pc, negated: ins.opcode === 0x08, cond, then: block(m, next, last!.address, bytes), else: block(m, target, elseTo, bytes) });
                pc = elseTo;
            } else {
                out.push({ kind: 'if', at: pc, negated: ins.opcode === 0x08, cond, then: block(m, next, target, bytes), else: [] });
                pc = target;
            }
            continue;
        }
        if (target !== undefined) throw new Unstructured(); // any other jump
        out.push({ kind: 'do', at: pc, bytes: bytes(pc, ins.size), summary: ins.summary, everscript: spelled(ins, bytes(pc, ins.size)) });
        pc = next;
    }
    return out;
}

/** The instruction ending exactly at `stop`, walking from `from`. */
function lastBefore(m: Machine, from: number, stop: number): Instruction | null {
    let last: Instruction | null = null;
    for (let a = from; a < stop;) { last = m.instruction(a)!; a += last.size; if (a > stop) throw new Unstructured(); }
    return last;
}

/**
 * Conditions with an exact Everscript spelling. A single flag test is the
 * common one: operand `0x85 lo hi` is `<addr, mask>` in the save bank,
 * `0x8a lo hi` in the room scratch bank.
 */
function condition(m: Machine, pc: number, ins: Instruction): string {
    const opLen = ins.size - 3;
    const b0 = m.u8(pc + 1);
    if (opLen === 3 && (b0 === 0x85 || b0 === 0x8a)) {
        const code = m.u16(pc + 2);
        const addr = (b0 === 0x85 ? 0x2258 : 0x2834) + (code >> 3);
        return `<0x${addr.toString(16).padStart(4, '0')}, ${hx(1 << (code & 7))}>`;
    }
    // Otherwise the evaluator's own rendering, when it only uses constructs
    // that have one Everscript spelling. The round-trip test compiles every
    // result, so a wrong spelling cannot pass unnoticed.
    const o = evalOperand(m.rom, pc + 1, m.toFile, {
        mem: new Memory(), stack: [], arg: () => ({ k: 'c', v: 0 }), lastEntity: { k: 'c', v: 0 },
        owner: { k: 'c', v: 0 }, fresh: (n) => ({ k: 'atom', name: n, volatile: true }),
    });
    if (!o.ok || o.length !== opLen || !SPELLABLE.test(o.src)) throw new Unstructured();
    return o.src.startsWith('(') && o.src.endsWith(')') && balanced(o.src.slice(1, -1)) ? o.src.slice(1, -1) : o.src;
}

/** Flags, word reads, ACTIVE/BOY/DOG, constants, ! and the comparison / logic operators. */
const SPELLABLE = /^(?:\s|<0x[0-9a-f]{4}(?:, 0x[0-9a-f]{2})?>|<BOY>|<DOG>|<ACTIVE>|<INACTIVE>|0x[0-9a-f]+|-?\d+|[()!]|==|!=|&&|\|\||<=|>=|<|>|&|\|)+$/;

function balanced(s: string): boolean {
    let d = 0;
    for (const ch of s) { if (ch === '(') d++; else if (ch === ')' && --d < 0) return false; }
    return d === 0;
}

/** Readable spellings that compile to exactly these bytes; null keeps `code(...)`. */
function spelled(ins: Instruction, b: number[]): string | null {
    if (ins.opcode === 0xa3 && b.length === 2) return `call_id(${hx(b[1])});`;
    // Flag := flag, the "taken only if the loot went through" idiom: 0c lo hi 85 lo hi
    if (ins.opcode === 0x0c && b.length === 6 && b[3] === 0x85) {
        const flag = (code: number): string => `<0x${(0x2258 + (code >> 3)).toString(16).padStart(4, '0')}, ${hx(1 << (code & 7))}>`;
        return `${flag(b[1] | (b[2] << 8))} = ${flag(b[4] | (b[5] << 8))};`;
    }
    return null;
}

function render(tree: Neutral[], indent: string): string {
    let s = '';
    for (const n of tree) {
        if (n.kind === 'end') { s += `${indent}end();\n`; continue; }
        if (n.kind === 'do') {
            const raw = `code(${n.bytes.map(hx).join(', ')});`;
            s += `${indent}${n.everscript ?? raw} // ${n.summary.replace(/\s+/g, ' ')}\n`;
            continue;
        }
        s += `${indent}${n.negated ? 'if!' : 'if'}(${n.cond}) {\n${render(n.then, indent + '    ')}${indent}}`;
        s += n.else.length ? ` else {\n${render(n.else, indent + '    ')}${indent}}\n` : '\n';
    }
    return s;
}
