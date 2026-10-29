// Ownership: one script's instructions as structured code — `if (…) { } else if (…) { } else { }`
// and `while (…) { }` — recovered from its branches and jumps, for reading. Pure.
//
// The interpreter only branches and jumps (docs/scripts/vm.md, "Flow"). Read in byte order:
//   - a forward branch skips the lines up to its target: they are an `if` body, run when the branch
//     is not taken (`if! (c) goto L` jumps when c is false, so the body runs when c holds);
//   - a forward `goto` that ends such a body jumps over the lines that follow it: the `else`; an else
//     that is only the next `if` reads as `else if`;
//   - a backward `goto` repeats the lines from its target: a loop, a `while (c)` when its first line
//     is the branch that leaves it.
// A branch or jump that does not nest inside the others stays a plain `goto`, so nothing is lost.

import type { Instruction } from '../script-vm';

/** A line of the structured listing: an instruction (`index` into the list, its text replaced when `text` is set) or a brace of its own. */
export type Row =
    | { kind: 'line'; index: number; depth: number; text?: string }
    | { kind: 'brace'; depth: number; text: string };

interface If { kind: 'if'; a: number; thenEnd: number; cond: string; k?: number; s?: number; e?: number; start: number; end: number }
interface Loop { kind: 'loop'; h: number; b: number; cond?: string; start: number; end: number }
type Shape = If | Loop;

/** The printer's conditional branch: `if (c) goto $target;` jumps when c holds, `if! (c) goto …` when it does not. */
const BRANCH = /^if(!?) \((.*)\) goto \$[0-9a-f]{2}:[0-9a-f]{4};$/;

/** Rows for `list` (one script, in byte order); `texts` is each instruction as printed. */
export function structure(list: Instruction[], texts: string[]): Row[] {
    const idx = new Map(list.map((ins, i) => [ins.address, i] as [number, number]));
    // The condition under which the lines a branch skips run: the branch not taken.
    const runs = (i: number): string | null => {
        const m = BRANCH.exec(texts[i]);
        return m ? (m[1] === '!' ? m[2] : negate(m[2])) : null;
    };
    const shapes: Shape[] = [];
    list.forEach((ins, i) => {
        const t = ins.target === null ? undefined : idx.get(ins.target);
        if (t === undefined) return;
        if (ins.flow === 'branch' && t > i + 1) {
            const cond = runs(i);
            if (cond === null) return;
            const k = t - 1, g = list[k];
            const e = g.flow === 'jump' && g.target !== null ? idx.get(g.target) : undefined;
            if (k > i + 1 && e !== undefined && e > t) shapes.push({ kind: 'if', a: i, thenEnd: k - 1, cond, k, s: t, e: e - 1, start: i, end: e - 1 });
            else shapes.push({ kind: 'if', a: i, thenEnd: t - 1, cond, start: i, end: t - 1 });
        } else if (ins.flow === 'jump' && t <= i) {
            const head = list[t];
            const exit = head.flow === 'branch' && t < i && head.target === ins.next ? runs(t) : null;
            shapes.push({ kind: 'loop', h: t, b: i, cond: exit ?? undefined, start: t, end: i });
        }
    });

    // Outer first; keep a shape only if it sits inside one part of every shape around it.
    // A while's head is also a forward branch to past the loop: the loop is the outer of the two.
    shapes.sort((x, y) => x.start - y.start || y.end - x.end || (x.kind === 'loop' ? -1 : 0) - (y.kind === 'loop' ? -1 : 0));
    const kept: Shape[] = [];
    const parts = (s: Shape): Array<[number, number]> => s.kind === 'loop'
        ? [[s.cond ? s.h + 1 : s.h, s.b - 1]]
        : s.k === undefined ? [[s.a + 1, s.thenEnd]] : [[s.a + 1, s.thenEnd], [s.s!, s.e!]];
    for (const c of shapes) {
        const fits = kept.every((o) => c.end < o.start || c.start > o.end
            || parts(o).some(([lo, hi]) => c.start >= lo && c.end <= hi));
        if (fits && !kept.some((o) => o.kind === c.kind && o.start === c.start)) kept.push(c);
    }
    const ifAt = new Map<number, If>(), loopAt = new Map<number, Loop>();
    for (const s of kept) if (s.kind === 'if') ifAt.set(s.a, s); else loopAt.set(s.h, s);

    const rows: Row[] = [];
    const emit = (lo: number, hi: number, d: number, inLoopAt = -1): void => {
        for (let p = lo; p <= hi;) {
            const L = loopAt.get(p);
            if (L && p !== inLoopAt) {
                if (L.cond !== undefined) { rows.push({ kind: 'line', index: p, depth: d, text: `while (${L.cond}) {` }); emit(p + 1, L.b - 1, d + 1); }
                else { rows.push({ kind: 'brace', depth: d, text: 'while (true) {' }); emit(p, L.b - 1, d + 1, p); }
                rows.push({ kind: 'line', index: L.b, depth: d, text: '}' });
                p = L.b + 1;
                continue;
            }
            const I = ifAt.get(p);
            if (I) { emitIf(I, d, false); p = I.end + 1; continue; }
            rows.push({ kind: 'line', index: p, depth: d });
            p++;
        }
    };
    const emitIf = (I: If, d: number, elif: boolean): void => {
        rows.push({ kind: 'line', index: I.a, depth: d, text: `${elif ? '} else if' : 'if'} (${I.cond}) {` });
        emit(I.a + 1, I.thenEnd, d + 1);
        if (I.k === undefined) { rows.push({ kind: 'brace', depth: d, text: '}' }); return; }
        const next = ifAt.get(I.s!);
        // An else that is only the next if: `} else if`, its goto (I.k) said by the brace.
        if (next && next.end === I.e && !loopAt.has(I.s!)) { emitIf(next, d, true); return; }
        rows.push({ kind: 'line', index: I.k, depth: d, text: '} else {' });
        emit(I.s!, I.e!, d + 1);
        rows.push({ kind: 'brace', depth: d, text: '}' });
    };
    emit(0, list.length - 1, 0);
    return rows;
}

/** `c` negated, as briefly as it reads: `!FLAG` → `FLAG`, `!(a && b)` → `a && b`, `x == 1` → `!(x == 1)`. */
function negate(c: string): string {
    const t = c.trim();
    if (/^![A-Za-z_]\w*$/.test(t) || /^!<[^<>]*>$/.test(t)) return t.slice(1);
    if (/^!\(.*\)$/.test(t) && balanced(t.slice(2, -1))) return t.slice(2, -1);
    if (/^[A-Za-z_]\w*$/.test(t) || /^<[^<>]*>$/.test(t)) return '!' + t;
    return '!(' + t + ')';
}

function balanced(s: string): boolean {
    let n = 0;
    for (const ch of s) { if (ch === '(') n++; else if (ch === ')' && --n < 0) return false; }
    return n === 0;
}
