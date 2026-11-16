// Ownership: the Code tab's if / else blocks in a routine's asm, pure (lines in, a depth per line out). A
// forward conditional branch skips an `if` body (the lines up to its target); when that body ends in an
// unconditional forward jump, the lines that jump skips are its `else`. An `else` that is itself one more
// such `if` ending where the `else` ends is an `else if`: it stays at the outer depth, so a chain reads flat.
// Blocks that cross an earlier one are not drawn; loops (backward branches) are not blocks.

/** As far as the blocks need a line of lines.json: its address, text and where it branches (`$` + bus address). */
interface BlockLine { addr: string; text: string; call?: string; jump?: string }

const COND = /^(bcc|bcs|beq|bne|bmi|bpl|bvc|bvs)\s/i;
const ALWAYS = /^(bra|brl|jmp|jml)\s[^(\[]*$/i;

/** Per line, how many if / else bodies it sits in. */
function blockDepths(lines: BlockLine[]): number[] {
    const index = new Map(lines.map((l, i) => [l.addr, i]));
    const target = (i: number): number => { const l = lines[i]; return l.call || !l.jump ? -1 : index.get(l.jump) ?? -1; };
    /** For a conditional branch on line i with a body: its `if` body, its `else` (or null) and where the whole ends. */
    const shape = (i: number): { then: [number, number]; els: [number, number] | null; end: number } | null => {
        const t = target(i);
        if (!COND.test(lines[i].text) || t <= i + 1) return null;
        const u = ALWAYS.test(lines[t - 1].text) ? target(t - 1) : -1;
        return { then: [i + 1, t - 1], els: u > t ? [t, u - 1] : null, end: u > t ? u : t };
    };
    const shapes = lines.map((_, i) => shape(i));
    const kept: [number, number][] = [];
    const crosses = ([a, b]: [number, number]): boolean => kept.some(([c, d]) => (a < c && c <= b && b < d) || (c < a && a <= d && d < b));
    for (const s of shapes) {
        if (!s || crosses(s.then)) continue;
        kept.push(s.then);
        if (!s.els || crosses(s.els)) continue;
        const inner = shapes[s.els[0]];
        if (!(inner && inner.end === s.els[1] + 1)) kept.push(s.els);
    }
    return lines.map((_, j) => kept.filter(([a, b]) => a <= j && j <= b).length);
}

export type { BlockLine };
export { blockDepths };
