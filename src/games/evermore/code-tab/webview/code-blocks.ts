// Ownership: the Code tab's if / else / loop blocks in a routine's asm, pure (lines in, per line a depth and a
// keyword out). A forward conditional branch skips an `if` body (the lines up to its target). When that body
// ends in a forward branch or jump past its target, conditional or not, the lines it skips are its `else` (the
// way it reads: `if bne` / `| lda` / `| bne` / `else` / `| jmp`). An `else` that is itself one more such `if`
// ending where the `else` ends is an `else if`: it stays at the outer depth, so a chain reads flat. A branch or
// jump back is a `do { … } while (…)` loop over the lines from its target. Blocks that cross an earlier one are
// not drawn (a branch that leaves its body is a goto). The keyword names the construct a line opens: `if` on its
// branch, `else` on an else's first line, `else if` on that branch, `while` on a loop's branch back.

/** As far as the blocks need a line of lines.json: its address, text and where it branches (`$` + bus address). */
interface BlockLine { addr: string; text: string; call?: string; jump?: string }

const COND = /^(bcc|bcs|beq|bne|bmi|bpl|bvc|bvs)\s/i;
const ALWAYS = /^(bra|brl|jmp|jml)\s[^(\[]*$/i;

type Keyword = '' | 'if' | 'else' | 'else if' | 'while';
interface Shape { then: [number, number]; els: [number, number] | null; end: number }

/** Per line, how many if / else / loop bodies it sits in, the construct it opens, and whether a loop starts there (`do`). */
function blockDepths(lines: BlockLine[]): { depth: number[]; kw: Keyword[]; loopHead: boolean[] } {
    const index = new Map(lines.map((l, i) => [l.addr, i]));
    const target = (i: number): number => { const l = lines[i]; return l.call || !l.jump ? -1 : index.get(l.jump) ?? -1; };
    /** For a conditional branch on line i with a body: its `if` body, its `else` (or null) and where the whole ends. */
    const shape = (i: number): Shape | null => {
        const t = target(i);
        if (!COND.test(lines[i].text) || t <= i + 1) return null;
        const u = COND.test(lines[t - 1].text) || ALWAYS.test(lines[t - 1].text) ? target(t - 1) : -1;
        return { then: [i + 1, t - 1], els: u > t ? [t, u - 1] : null, end: u > t ? u : t };
    };
    const shapes = lines.map((_, i) => shape(i));
    /** Loops: a branch or jump on line j back to line h ≤ j - 1, the body h…j-1. */
    const loops = lines.map((l, j) => {
        const h = target(j);
        return h >= 0 && h < j && (COND.test(l.text) || ALWAYS.test(l.text)) ? h : -1;
    });
    // `kept`: the bodies (they indent); `spans`: whole constructs, an `if` from its branch line, a loop from its
    // first line to its branch back, for crossing. Outer constructs first (by start, longer first). A branch on
    // the last line of a body that skips past it crosses that body: a goto, not an if.
    const kept: [number, number][] = [], spans: [number, number][] = [];
    const kw: Keyword[] = lines.map(() => ''), loopHead = lines.map(() => false);
    const crosses = ([a, b]: [number, number]): boolean => spans.some(([c, d]) => (a < c && c <= b && b < d) || (c < a && a <= d && d < b));
    const order: { at: number; span: [number, number]; loop: boolean }[] = [];
    shapes.forEach((s, i) => { if (s) order.push({ at: i, span: [i, s.end - 1], loop: false }); });
    loops.forEach((h, j) => { if (h >= 0) order.push({ at: j, span: [h, j], loop: true }); });
    order.sort((x, y) => x.span[0] - y.span[0] || y.span[1] - x.span[1]);
    for (const { at: i, span, loop } of order) {
        if (loop) {
            if (crosses(span) || kw[i]) continue;
            spans.push(span);
            kept.push([span[0], i - 1]);
            loopHead[span[0]] = true;
            kw[i] = 'while';
            continue;
        }
        const s = shapes[i]!;
        if (crosses([i, s.then[1]])) continue;
        spans.push([i, s.then[1]]);
        kept.push(s.then);
        kw[i] ||= 'if';
        if (!s.els || crosses(s.els)) continue;
        spans.push(s.els);
        const inner = shapes[s.els[0]], elseIf = !!inner && inner.end === s.els[1] + 1;
        kw[s.els[0]] = elseIf ? 'else if' : 'else';
        if (!elseIf) kept.push(s.els);
    }
    return { depth: lines.map((_, j) => kept.filter(([a, b]) => a <= j && j <= b).length), kw, loopHead };
}

export type { BlockLine, Keyword };
export { blockDepths };
