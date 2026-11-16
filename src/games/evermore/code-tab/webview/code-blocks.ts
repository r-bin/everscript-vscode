// Ownership: the Code tab's if / else blocks in a routine's asm, pure (lines in, per line a depth, a keyword and
// the branches of its condition out). A forward conditional branch skips an `if` body (the lines up to its
// target); several branches with only side-effect-free lines between them, each going to the body (the line
// after the last) or past it, are one `if` with an `||` / `&&` condition. When the body ends in an
// unconditional forward jump, the lines that jump skips are its `else`. An `else` that is itself one more
// such `if` ending where the `else` ends is an `else if`: it stays at the outer depth, so a chain reads flat.
// A branch or jump back is a `do { … } while (…)` loop over the lines from its target. Blocks that cross an
// earlier one are not drawn (a branch that leaves its body is a goto). The keyword names the construct a line opens: `if` on its first branch, `else` on an
// else's first line, `else if` on that branch.

/** As far as the blocks need a line of lines.json: its address, text and where it branches (`$` + bus address). */
interface BlockLine { addr: string; text: string; call?: string; jump?: string }

const COND = /^(bcc|bcs|beq|bne|bmi|bpl|bvc|bvs)\s/i;
const ALWAYS = /^(bra|brl|jmp|jml)\s[^(\[]*$/i;
/** Lines that may sit between the branches of one condition: they change registers and flags, nothing else. */
const QUIET = /^((lda|ldx|ldy|and|ora|eor|adc|sbc|cmp|cpx|cpy|bit|rep|sep)\s|(tax|tay|txa|tya|txy|tyx|inx|iny|dex|dey|clc|sec)$|(asl|lsr|rol|ror|inc|dec)(\s+a)?$)/i;

type Keyword = '' | 'if' | 'else' | 'else if' | 'while';
interface Shape { chain: number[]; then: [number, number]; els: [number, number] | null; end: number }

/**
 * Per line, how many if / else / loop bodies it sits in, the construct it opens (`while` on a loop's branch
 * back), for `if` / `else if` its branches, and whether a loop starts there (`do`).
 */
function blockDepths(lines: BlockLine[]): { depth: number[]; kw: Keyword[]; chains: number[][]; loopHead: boolean[] } {
    const index = new Map(lines.map((l, i) => [l.addr, i]));
    const target = (i: number): number => { const l = lines[i]; return l.call || !l.jump ? -1 : index.get(l.jump) ?? -1; };
    const entered = new Set(lines.map((_, i) => target(i)));
    /** For a conditional branch on line i: the longest chain of branches from it that forms one condition. */
    const shape = (i: number): Shape | null => {
        if (!COND.test(lines[i].text)) return null;
        let best: Shape | null = null;
        const chain: number[] = [];
        for (let k = i; k < lines.length; k++) {
            if (k > i && (entered.has(k) || !(COND.test(lines[k].text) || QUIET.test(lines[k].text)))) break;
            if (!COND.test(lines[k].text)) continue;
            chain.push(k);
            const t = k + 1, e = target(k);
            if (e <= t || !chain.every((b) => b === k || target(b) === t || target(b) === e)) continue;
            const u = ALWAYS.test(lines[e - 1].text) ? target(e - 1) : -1;
            best = { chain: chain.slice(), then: [t, e - 1], els: u > e ? [e, u - 1] : null, end: u > e ? u : e };
        }
        return best;
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
    const kept: [number, number][] = [], spans: [number, number][] = [], used = new Set<number>();
    const kw: Keyword[] = lines.map(() => ''), chains: number[][] = lines.map(() => []), loopHead = lines.map(() => false);
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
        if (used.has(i) || crosses([i, s.then[1]])) continue;
        spans.push([i, s.then[1]]);
        kept.push(s.then);
        kw[i] ||= 'if';
        chains[i] = s.chain;
        for (const b of s.chain) used.add(b);
        if (!s.els || crosses(s.els)) continue;
        spans.push(s.els);
        const inner = shapes[s.els[0]], elseIf = !!inner && inner.end === s.els[1] + 1;
        kw[s.els[0]] = elseIf ? 'else if' : 'else';
        if (!elseIf) kept.push(s.els);
    }
    return { depth: lines.map((_, j) => kept.filter(([a, b]) => a <= j && j <= b).length), kw, chains, loopHead };
}

export type { BlockLine, Keyword };
export { blockDepths };
