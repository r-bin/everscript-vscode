// Ownership: the C condition of an `if` in a routine's asm, pure (lines in, a string out). From the start of
// the branch's basic block (the nearest line something jumps to) to the branch, A, X and Y are followed as C
// expressions and each flag remembers what set it (a load, a compare, a bit test, a shift, a sum, a call); the branch's
// flag then reads as C. The condition is the one under which the `if` body runs: the branch NOT taken.
// What cannot be followed stays a flag name (Z, C, N, V). A guess for reading, never a decompilation.

/** As far as a condition needs a line of lines.json: text, text by name, the routine it calls, where it jumps. */
interface CondLine { addr: string; text: string; named?: string; call?: string; jump?: string }

type ZN = { k: 'val'; e: string } | { k: 'cmp'; l: string; r: string } | { k: 'bit'; a: string; m: string; imm: boolean } | { k: 'call'; name: string } | null;
type C = { k: 'cmp'; l: string; r: string } | { k: 'lsr' | 'asl' | 'sum'; e: string } | { k: 'const'; on: boolean } | { k: 'call'; name: string } | null;
type V = { k: 'bit'; m: string } | { k: 'call'; name: string } | null;
interface State { A: string; X: string; Y: string; zn: ZN; c: C; v: V }

const OPPOSITE: Record<string, string> = { beq: 'bne', bne: 'beq', bcc: 'bcs', bcs: 'bcc', bmi: 'bpl', bpl: 'bmi', bvc: 'bvs', bvs: 'bvc' };
/** Longer expressions fall back to the register's name. */
const MAX = 80;

const wrap = (e: string): string => (/^[\w.$\[\]*()]+$/.test(e) ? e : '(' + e + ')');

/** An operand in C: `#$04` → `0x04`, `NAME,x` → `NAME[X]`, `NAME[2],x` → `NAME[2 + X]`, `($12),y` → `(*$12)[Y]`, `3,s` → `stack[3]`. */
function operand(op: string): string {
    let m: RegExpExecArray | null;
    if ((m = /^#\$([0-9A-F]+)$/i.exec(op))) return '0x' + m[1];
    if ((m = /^[([](.+)[)\]],y$/i.exec(op))) return '(*' + wrap(m[1]) + ')[Y]';
    if ((m = /^\((.+),x\)$/i.exec(op))) return '*' + wrap(m[1] + '[X]');
    if ((m = /^[([](.+)[)\]]$/.exec(op))) return '*' + wrap(m[1]);
    if ((m = /^(.+),s$/i.exec(op))) return 'stack[' + m[1] + ']';
    if ((m = /^(.+),([xy])$/i.exec(op))) {
        const r = m[2].toUpperCase(), at = /^(.*)\[([^\]]+)\]$/.exec(m[1]);
        return at ? at[1] + '[' + (at[2] === '0' ? r : at[2] + ' + ' + r) + ']' : m[1] + '[' + r + ']';
    }
    return op;
}

const cap = (e: string, reg: string): string => (e.length > MAX ? reg : e);

/** One instruction's effect on the state (65816; widths are not followed). */
function step(s: State, l: CondLine, named: boolean): void {
    const text = (named && l.named) || l.text, sp = text.indexOf(' ');
    const mn = (sp < 0 ? text : text.slice(0, sp)).toLowerCase(), raw = sp < 0 ? '' : text.slice(sp + 1).trim();
    const op = operand(raw), onA = raw === '' || raw.toLowerCase() === 'a';
    const reg = mn[2]?.toUpperCase() as 'A' | 'X' | 'Y';
    const set = (r: 'A' | 'X' | 'Y', e: string) => { s[r] = cap(e, r); s.zn = { k: 'val', e: s[r] }; };
    switch (mn) {
        case 'lda': case 'ldx': case 'ldy': set(reg, op); return;
        case 'tax': case 'tay': case 'txa': case 'tya': case 'txy': case 'tyx': set(mn[2].toUpperCase() as 'A', s[mn[1].toUpperCase() as 'A']); return;
        case 'and': set('A', wrap(s.A) + ' & ' + op); return;
        case 'ora': set('A', wrap(s.A) + ' | ' + op); return;
        case 'eor': set('A', wrap(s.A) + ' ^ ' + op); return;
        case 'adc': case 'sbc': set('A', wrap(s.A) + (mn === 'adc' ? ' + ' : ' - ') + op); s.c = { k: 'sum', e: s.A }; s.v = null; return;
        case 'cmp': case 'cpx': case 'cpy': {
            const r = mn === 'cmp' ? s.A : s[mn[2].toUpperCase() as 'X'];
            s.zn = { k: 'cmp', l: r, r: op }; s.c = { k: 'cmp', l: r, r: op }; return;
        }
        case 'bit': s.zn = { k: 'bit', a: s.A, m: op, imm: raw.startsWith('#') }; if (!raw.startsWith('#')) s.v = { k: 'bit', m: op }; return;
        case 'inc': case 'dec': {
            const e = (onA ? wrap(s.A) : wrap(op)) + (mn === 'inc' ? ' + 1' : ' - 1');
            if (onA) set('A', e); else s.zn = { k: 'val', e }; return;
        }
        case 'inx': case 'iny': case 'dex': case 'dey': { const r = mn[2].toUpperCase() as 'X'; set(r, wrap(s[r]) + (mn[0] === 'i' ? ' + 1' : ' - 1')); return; }
        case 'asl': case 'lsr': {
            const from = onA ? s.A : op, e = wrap(from) + (mn === 'asl' ? ' << 1' : ' >> 1');
            s.c = { k: mn, e: from };
            if (onA) set('A', e); else s.zn = { k: 'val', e }; return;
        }
        case 'rol': case 'ror': if (onA) s.A = 'A'; s.zn = null; s.c = null; return;
        case 'sec': case 'clc': s.c = { k: 'const', on: mn === 'sec' }; return;
        case 'clv': s.v = null; return;
        case 'pla': case 'plx': case 'ply': set(mn[2].toUpperCase() as 'A', 'pop()'); return;
        case 'jsl': case 'jsr': {
            const name = l.call || op;
            Object.assign(s, { A: 'A', X: 'X', Y: 'Y', zn: { k: 'call', name }, c: { k: 'call', name }, v: { k: 'call', name } });
            return;
        }
        case 'sta': case 'stx': case 'sty': case 'stz': case 'pha': case 'phx': case 'phy': case 'php': case 'phb': case 'phd': case 'phk':
        case 'pea': case 'pei': case 'per': case 'sei': case 'cli': case 'sed': case 'cld': case 'rep': case 'sep': case 'nop':
        case 'beq': case 'bne': case 'bcc': case 'bcs': case 'bmi': case 'bpl': case 'bvc': case 'bvs': return;
        default: Object.assign(s, { A: 'A', X: 'X', Y: 'Y', zn: null, c: null, v: null });
    }
}

/** What branch `mn` tests, as C, when it is taken. */
function taken(mn: string, s: State): string {
    const not = (e: string): string => (/^!\w+$/.test(e) ? e.slice(1) : '!' + wrap(e));
    const z = s.zn, c = s.c, v = s.v;
    switch (mn) {
        case 'beq': case 'bne': {
            const eq = mn === 'beq';
            if (z?.k === 'val') return / & /.test(z.e) && !/ [|^+-] /.test(z.e) ? (eq ? not(z.e) : z.e) : z.e + (eq ? ' == 0' : ' != 0');
            if (z?.k === 'cmp') return wrap(z.l) + (eq ? ' == ' : ' != ') + wrap(z.r);
            if (z?.k === 'bit') return eq ? '!(' + wrap(z.a) + ' & ' + z.m + ')' : wrap(z.a) + ' & ' + z.m;
            if (z?.k === 'call') return (eq ? '' : '!') + z.name + '() → Z';
            return eq ? 'Z' : '!Z';
        }
        case 'bmi': case 'bpl': {
            const lt = mn === 'bmi' ? ' < 0' : ' >= 0';
            if (z?.k === 'val') return '(signed)' + wrap(z.e) + lt;
            if (z?.k === 'cmp') return '(signed)(' + z.l + ' - ' + z.r + ')' + lt;
            if (z?.k === 'bit' && !z.imm) return '(signed)' + wrap(z.m) + lt;
            if (z?.k === 'call') return (mn === 'bmi' ? '' : '!') + z.name + '() → N';
            return mn === 'bmi' ? 'N' : '!N';
        }
        case 'bcc': case 'bcs': {
            const set = mn === 'bcs';
            if (c?.k === 'cmp') return wrap(c.l) + (set ? ' >= ' : ' < ') + wrap(c.r);
            if (c?.k === 'lsr') return set ? wrap(c.e) + ' & 1' : '!(' + wrap(c.e) + ' & 1)';
            if (c?.k === 'sum') return (set ? '' : '!') + 'carry(' + c.e + ')';
            if (c?.k === 'asl') return '(signed)' + wrap(c.e) + (set ? ' < 0' : ' >= 0');
            if (c?.k === 'const') return String(c.on === set);
            if (c?.k === 'call') return (set ? '' : '!') + c.name + '() → C';
            return set ? 'C' : '!C';
        }
        default: {
            const set = mn === 'bvs';
            if (v?.k === 'bit') return (set ? '' : '!') + 'bit6(' + v.m + ')';
            if (v?.k === 'call') return (set ? '' : '!') + v.name + '() → V';
            return set ? 'V' : '!V';
        }
    }
}

/** The C condition under which the lines after the conditional branch on line `i` run, or null for no branch. */
function bodyCondition(lines: CondLine[], i: number, named: boolean): string | null {
    const mn = lines[i].text.slice(0, 3).toLowerCase();
    if (!OPPOSITE[mn]) return null;
    const index = new Map(lines.map((l, n) => [l.addr, n]));
    let start = 0;
    for (const l of lines) {
        const to = l.call || !l.jump ? undefined : index.get(l.jump);
        if (to !== undefined && to <= i && to > start) start = to;
    }
    const s: State = { A: 'A', X: 'X', Y: 'Y', zn: null, c: null, v: null };
    for (let n = start; n < i; n++) step(s, lines[n], named);
    return taken(OPPOSITE[mn], s);
}

export type { CondLine };
export { bodyCondition };
