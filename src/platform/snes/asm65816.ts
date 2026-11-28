/**
 * platform/snes/asm65816.ts
 *
 * A 65816 assembler for the Asar syntax that platform/cdl/disasm.ts writes (every operand sized: `.b` direct page,
 * `.w` absolute, `.l` long; `jsl`/`jml` long; branches to labels), so text that printer wrote assembles back to the
 * same bytes without an external tool. A hand-written operand without a size takes it as Asar does: a `$` number by the
 * digits written (`$12` direct page, `$0012` absolute, `$7E0012` long), a decimal one by its value.
 * Supported: `label:` (global), `NAME = expr` / `!NAME = expr`, instructions, `db`/`dw`/`dl`, `db "text"` (printable
 * ASCII, one byte a character, as Asar's default table), `skip n`, `org`, and expressions of numbers ($hex, %bin,
 * decimal), labels, `!DEFINE`s, parentheses, unary `~`/`+`/`-` and + - * / << >> & |. Not supported: macros,
 * sublabels, incsrc/incbin. Hardware fact only (no game in here).
 *
 * Sizes never depend on label values (every operand's width comes from its text), so a file is measured once and
 * encoded once all labels are known (`measure` → `encode`), wherever it is placed.
 */

import { OPCODES } from './opcodes-65816';

export interface AsmError { file: string; line: number; message: string }

/** One statement, measured: where it starts in its file's bytes and how long it is. */
interface Statement {
    line: number; offset: number; length: number;
    kind: 'ins' | 'data' | 'skip' | 'org';
    op?: number; mode?: string; operand?: string; operand2?: string;
    /** data: element width in bytes and the expressions. */
    width?: number; values?: string[];
}

export interface Measured {
    file: string;
    length: number;
    /** Labels by offset in the file's bytes. */
    labels: Map<string, number>;
    /** Constant / define assignments (`NAME = expr`, `!NAME = expr`) in the file. */
    defs: Map<string, string>;
    /** Byte ranges (offset, length) the file skips: not its bytes. */
    skips: { offset: number; length: number }[];
    statements: Statement[];
    /** `org` statements: offset in the file → bus address (a file with none takes the address it is placed at). */
    orgs: { offset: number; bus: number }[];
}

const BY_MODE = new Map<string, number>();
OPCODES.forEach((o, op) => BY_MODE.set(o.mnemonic + ' ' + o.mode, op));
const has = (m: string, mode: string) => BY_MODE.has(m + ' ' + mode);

const REL8 = new Set(['BPL', 'BMI', 'BVC', 'BVS', 'BCC', 'BCS', 'BNE', 'BEQ', 'BRA']);
const LABEL_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LINE_LABEL_RE = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/;

/** Operand byte count per mode; M/X immediates are sized by the suffix. */
const SIZE: Record<string, number> = {
    imp: 0, acc: 0, imm8: 1, dp: 1, dpx: 1, dpy: 1, idp: 1, idpx: 1, idpy: 1, ildp: 1, ildpy: 1, sr: 1, isry: 1,
    abs: 2, absx: 2, absy: 2, long: 3, longx: 3, rel8: 1, rel16: 2, iabs: 2, iabsx: 2, ilabs: 2, bm: 2, pea: 2, pei: 1,
};

/** A line without its comment: `;` starts one, except inside a "string". */
function stripComment(s: string): string {
    let quoted = false;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '"') quoted = !quoted;
        else if (s[i] === ';' && !quoted) return s.slice(0, i);
    }
    return s;
}

/** Splits `a,b` at top-level commas (not inside brackets or a "string"). */
function splitTop(s: string): string[] {
    const out: string[] = [];
    let depth = 0, start = 0, quoted = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '"') quoted = !quoted;
        if (quoted) continue;
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (c === ',' && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
    }
    out.push(s.slice(start).trim());
    return out;
}

/** The addressing form of an operand: the mode family and the expression inside it. */
function form(text: string): { shape: string; expr: string; expr2?: string } {
    const t = text.trim();
    let m: RegExpExecArray | null;
    if (t === '') return { shape: 'none', expr: '' };
    if (/^a$/i.test(t)) return { shape: 'acc', expr: '' };
    if (t.startsWith('#')) return splitTop(t).length > 1 ? { shape: 'bad', expr: t } : { shape: 'imm', expr: t.slice(1).trim() };
    if ((m = /^\((.+),\s*s\)\s*,\s*y$/i.exec(t))) return { shape: 'isry', expr: m[1] };
    if ((m = /^\((.+),\s*x\)$/i.exec(t))) return { shape: 'idpx', expr: m[1] };
    if ((m = /^\((.+)\)\s*,\s*y$/i.exec(t))) return { shape: 'idpy', expr: m[1] };
    if ((m = /^\[(.+)\]\s*,\s*y$/i.exec(t))) return { shape: 'ildpy', expr: m[1] };
    if ((m = /^\((.+)\)$/.exec(t))) return { shape: 'idp', expr: m[1] };
    if ((m = /^\[(.+)\]$/.exec(t))) return { shape: 'ildp', expr: m[1] };
    const parts = splitTop(t);
    if (parts.length === 2 && /^[xys]$/i.test(parts[1])) return { shape: 'idx' + parts[1].toLowerCase(), expr: parts[0] };
    if (parts.length === 2) return { shape: 'pair', expr: parts[0], expr2: parts[1] };
    return { shape: 'plain', expr: t };
}

/** A number literal's value, or null when the expression is not a plain number. */
function literal(expr: string): number | null {
    const t = expr.trim();
    if (/^\$[0-9a-f]+$/i.test(t)) return parseInt(t.slice(1), 16);
    if (/^%[01]+$/.test(t)) return parseInt(t.slice(1), 2);
    if (/^[0-9]+$/.test(t)) return parseInt(t, 10);
    return null;
}

/** The width (1-3 bytes) a number literal is written in, as Asar reads it; null when it is not a literal. */
function literalWidth(expr: string): number | null {
    const t = expr.trim();
    if (/^\$[0-9a-f]+$/i.test(t)) return t.length - 1 <= 2 ? 1 : t.length - 1 <= 4 ? 2 : 3;
    if (/^%[01]+$/.test(t)) return t.length - 1 <= 8 ? 1 : t.length - 1 <= 16 ? 2 : 3;
    const v = literal(t);
    return v === null ? null : v <= 0xFF ? 1 : v <= 0xFFFF ? 2 : 3;
}

/** Picks the opcode and mode for a mnemonic, its size suffix and its operand. */
function choose(mn: string, size: string, text: string): { op: number; mode: string; length: number; expr: string; expr2?: string } | string {
    const f = form(text);
    const pick = (mode: string, extra = 0) => has(mn, mode) ? { op: BY_MODE.get(mn + ' ' + mode)!, mode, length: 1 + (SIZE[mode] ?? extra), expr: f.expr, expr2: f.expr2 } : null;
    const fail = `${mn.toLowerCase()}${size ? '.' + size : ''} ${text}: no such instruction`;
    if (f.shape === 'none') return pick('imp') ?? fail;
    if (f.shape === 'acc') return pick('acc') ?? fail;
    if (REL8.has(mn)) return f.shape === 'plain' ? pick('rel8')! : fail;
    if (mn === 'BRL' || mn === 'PER') return f.shape === 'plain' ? pick('rel16')! : fail;
    if (mn === 'MVN' || mn === 'MVP') return f.shape === 'pair' ? pick('bm')! : fail;
    if (mn === 'PEA') return f.shape === 'plain' ? pick('pea')! : fail;
    if (mn === 'PEI') return f.shape === 'idp' ? pick('pei')! : fail;
    if (f.shape === 'bad') return fail;
    if (f.shape === 'imm') {
        if (has(mn, 'imm8')) return pick('imm8')!;
        const mode = has(mn, 'immM') ? 'immM' : has(mn, 'immX') ? 'immX' : null;
        if (!mode) return fail;
        const lw = literalWidth(f.expr);
        const wide = size === 'w' || (size === '' && lw !== null && lw > 1);
        if (size === 'l') return fail;
        if (size === '' && lw === null) return `${mn.toLowerCase()} #${f.expr}: give the immediate's size (.b or .w)`;
        return { op: BY_MODE.get(mn + ' ' + mode)!, mode, length: wide ? 3 : 2, expr: f.expr };
    }
    if ((mn === 'JMP' || mn === 'JSR') && f.shape === 'idpx') return pick('iabsx') ?? fail;
    if (mn === 'JMP' && f.shape === 'idp') return pick('iabs') ?? fail;
    if ((mn === 'JML' || mn === 'JMP') && f.shape === 'ildp') return has('JML', 'ilabs') ? { op: BY_MODE.get('JML ilabs')!, mode: 'ilabs', length: 3, expr: f.expr } : fail;
    if (mn === 'JSL' || mn === 'JML') return f.shape === 'plain' ? pick('long')! : fail;
    // jmp.l / jsr.l, and a jump to a number written long: jml / jsl, as Asar reads them.
    if ((mn === 'JMP' || mn === 'JSR') && f.shape === 'plain' && (size === 'l' || (size === '' && literalWidth(f.expr) === 3))) {
        return { op: BY_MODE.get(mn === 'JMP' ? 'JML long' : 'JSL long')!, mode: 'long', length: 4, expr: f.expr };
    }
    // Sized by the suffix, or by the digits of a plain number (Asar); a label needs a suffix, except a jump's.
    let width = size === 'b' ? 1 : size === 'w' ? 2 : size === 'l' ? 3 : 0;
    if (!width) {
        if (mn === 'JMP' || mn === 'JSR') width = 2;
        else {
            const lw = literalWidth(f.expr);
            if (lw === null) return `${mn.toLowerCase()} ${text}: give the operand's size (.b, .w or .l)`;
            width = lw;
        }
    }
    const modes: Record<string, Record<number, string>> = {
        plain: { 1: 'dp', 2: 'abs', 3: 'long' }, idxx: { 1: 'dpx', 2: 'absx', 3: 'longx' }, idxy: { 1: 'dpy', 2: 'absy' },
        idxs: { 1: 'sr' }, idp: { 1: 'idp' }, idpx: { 1: 'idpx' }, idpy: { 1: 'idpy' }, ildp: { 1: 'ildp' }, ildpy: { 1: 'ildpy' }, isry: { 1: 'isry' },
    };
    const mode = modes[f.shape]?.[width];
    // `lda $12,y` without a size has no direct-page form, so it is absolute (Asar); written `.b`, it is an error.
    if (mode) return pick(mode) ?? (f.shape === 'idxy' && width === 1 && !size ? pick('absy') : null) ?? fail;
    return fail;
}

/** Measures one file: statements, sizes, labels. */
export function measure(file: string, text: string, errors: AsmError[]): Measured {
    const out: Measured = { file, length: 0, labels: new Map(), defs: new Map(), skips: [], statements: [], orgs: [] };
    const lines = text.split(/\r?\n/);
    lines.forEach((raw, i) => {
        const line = i + 1;
        const err = (message: string) => errors.push({ file, line, message });
        let s = stripComment(raw).trim();
        let m: RegExpExecArray | null;
        while ((m = LINE_LABEL_RE.exec(s))) {
            if (out.labels.has(m[1])) err(`label ${m[1]} defined twice`);
            out.labels.set(m[1], out.length);
            s = m[2].trim();
        }
        if (!s) return;
        const dm = /^(!?[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(s);
        if (dm) { out.defs.set(dm[1], dm[2].trim()); return; }
        const sp = s.search(/\s/);
        const head = (sp < 0 ? s : s.slice(0, sp)).toLowerCase(), rest = sp < 0 ? '' : s.slice(sp + 1).trim();
        const [word, size = ''] = head.split('.');
        if (word === 'db' || word === 'dw' || word === 'dl') {
            const width = word === 'db' ? 1 : word === 'dw' ? 2 : 3;
            const values = splitTop(rest).filter(v => v !== '').flatMap(v => {
                if (!v.startsWith('"')) return [v];
                if (width !== 1 || !/^"[ !#-~]+"$/.test(v)) { err(`a string is printable ASCII in quotes, in db: ${v}`); return []; }
                return Array.from(v.slice(1, -1), c => String(c.charCodeAt(0)));
            });
            if (!values.length) err(`${word} without values`);
            out.statements.push({ line, offset: out.length, length: width * values.length, kind: 'data', width, values });
            out.length += width * values.length;
            return;
        }
        if (word === 'skip') {
            const n = literal(rest);
            if (n === null) { err('skip takes a number'); return; }
            out.skips.push({ offset: out.length, length: n });
            out.statements.push({ line, offset: out.length, length: n, kind: 'skip' });
            out.length += n;
            return;
        }
        if (word === 'org') {
            const v = literal(rest);
            if (v === null) { err('org takes a number'); return; }
            out.orgs.push({ offset: out.length, bus: v });
            out.statements.push({ line, offset: out.length, length: 0, kind: 'org' });
            return;
        }
        const mn = word.toUpperCase();
        if (!OPCODES.some(o => o.mnemonic === mn)) { err(`unknown instruction or directive "${head}"`); return; }
        if (size && !/^[bwl]$/.test(size)) { err(`unknown size .${size}`); return; }
        const c = choose(mn, size, rest);
        if (typeof c === 'string') { err(c); return; }
        out.statements.push({ line, offset: out.length, length: c.length, kind: 'ins', op: c.op, mode: c.mode, operand: c.expr, operand2: c.expr2 });
        out.length += c.length;
    });
    return out;
}

/** Evaluates an expression; labels and `!defines` from `symbols` (bus addresses / values). String on error. */
export function evaluate(expr: string, symbols: (name: string) => number | undefined): number | string {
    const tokens = expr.match(/\$[0-9a-fA-F]+|%[01]+|[0-9]+|!?[A-Za-z_][A-Za-z0-9_]*|<<|>>|[-+*/&|~()]|\S/g) ?? [];
    let i = 0;
    const PREC: Record<string, number> = { '|': 1, '&': 2, '<<': 3, '>>': 3, '+': 4, '-': 4, '*': 5, '/': 5 };
    const atom = (): number | string => {
        const t = tokens[i++];
        if (t === undefined) return 'expression ends too soon';
        if (t === '-') { const v = atom(); return typeof v === 'string' ? v : -v; }
        if (t === '+') return atom();
        if (t === '~') { const v = atom(); return typeof v === 'string' ? v : ~v; }
        if (t === '(') {
            const v = climb(1);
            if (typeof v === 'string') return v;
            if (tokens[i++] !== ')') return 'missing ")"';
            return v;
        }
        if (t.startsWith('!')) { const v = symbols(t); return v === undefined ? `unknown define ${t}` : v; }
        const n = literal(t);
        if (n !== null) return n;
        if (LABEL_RE.test(t)) { const v = symbols(t); return v === undefined ? `unknown label ${t}` : v; }
        return `unexpected "${t}"`;
    };
    const climb = (min: number): number | string => {
        let left = atom();
        if (typeof left === 'string') return left;
        while (i < tokens.length && (PREC[tokens[i]] ?? 0) >= min) {
            const op = tokens[i++], right = climb(PREC[op] + 1);
            if (typeof right === 'string') return right;
            if (op === '/' && right === 0) return 'division by zero';
            left = op === '+' ? left + right : op === '-' ? left - right : op === '*' ? left * right : op === '/' ? Math.trunc(left / right)
                : op === '<<' ? left << right : op === '>>' ? left >> right : op === '&' ? left & right : left | right;
        }
        return left;
    };
    const v = climb(1);
    if (typeof v !== 'string' && i < tokens.length) return `unexpected "${tokens[i]}"`;
    return v;
}

/**
 * Encodes a measured file placed at bus address `bus` (its first byte). `symbols`: every label's bus address (its own
 * and other files') and `!DEFINE` values. Skipped bytes stay 0 in the result.
 */
export function encode(m: Measured, bus: number, symbols: (name: string) => number | undefined, errors: AsmError[]): Uint8Array {
    const bytes = new Uint8Array(m.length);
    const resolvedDefs = new Map<string, number>(), evaluating = new Set<string>();
    const lookup = (name: string): number | undefined => {
        if (!m.defs.has(name)) return symbols(name);
        if (resolvedDefs.has(name)) return resolvedDefs.get(name);
        if (evaluating.has(name)) return undefined;
        evaluating.add(name);
        const v = evaluate(m.defs.get(name)!, lookup);
        evaluating.delete(name);
        if (typeof v !== 'number') return undefined;
        resolvedDefs.set(name, v);
        return v;
    };
    let base = bus, baseOffset = 0;
    for (const st of m.statements) {
        const err = (message: string) => errors.push({ file: m.file, line: st.line, message });
        const val = (expr: string): number | null => { const v = evaluate(expr, lookup); if (typeof v === 'string') { err(v); return null; } return v; };
        const put = (at: number, v: number, n: number) => { for (let k = 0; k < n; k++) bytes[at + k] = (v >>> (8 * k)) & 0xFF; };
        if (st.kind === 'org') { const o = m.orgs.find(x => x.offset === st.offset)!; base = o.bus; baseOffset = st.offset; continue; }
        if (st.kind === 'skip') continue;
        if (st.kind === 'data') {
            st.values!.forEach((e, k) => {
                const v = val(e), w = st.width!;
                if (v === null) return;
                if (literal(e) !== null && v >= 2 ** (8 * w)) { err(`${e} does not fit in ${w} byte${w > 1 ? 's' : ''}`); return; }
                put(st.offset + k * w, v, w);
            });
            continue;
        }
        bytes[st.offset] = st.op!;
        const n = st.length - 1;
        if (!n) continue;
        const here = (base + st.offset - baseOffset) & 0xFFFFFF;
        if (st.mode === 'rel8' || st.mode === 'rel16') {
            const t = val(st.operand!);
            if (t === null) continue;
            if ((t & 0xFF0000) !== (here & 0xFF0000)) { err(`branch to ${st.operand} leaves bank $${(here >>> 16).toString(16).toUpperCase()}`); continue; }
            const disp = ((t - (here + st.length)) << 16) >> 16;
            if (st.mode === 'rel8' && (disp < -128 || disp > 127)) { err(`branch to ${st.operand} is ${disp} bytes away (−128…127)`); continue; }
            put(st.offset + 1, disp, n);
            continue;
        }
        if (st.mode === 'bm') {
            const a = val(st.operand!), b = val(st.operand2!);
            if (a !== null && b !== null) { bytes[st.offset + 1] = a & 0xFF; bytes[st.offset + 2] = b & 0xFF; }
            continue;
        }
        const v = val(st.operand!);
        if (v === null) continue;
        // A number wider than its operand is an error; a label gives its low bytes (`jsr.w label`, as Asar).
        // A jmp/jsr target is an address in the instruction's own bank: a long value is fine only there.
        const jump = st.mode === 'abs' && (st.op === 0x20 || st.op === 0x4C);
        if (jump && v > 0xFFFF && (v & 0xFF0000) !== (here & 0xFF0000)) {
            err(`${st.operand} is in bank $${(v >>> 16).toString(16).toUpperCase()}: jmp and jsr stay in their bank (jml, jsl)`); continue;
        }
        if (!jump && literal(st.operand!) !== null && v >= 2 ** (8 * n)) { err(`${st.operand} does not fit in ${n} byte${n > 1 ? 's' : ''}`); continue; }
        put(st.offset + 1, v, n);
    }
    return bytes;
}
