// Ownership: an expression's value from the cells it reads — the ones the listing set above
// (icons.ts) or the running game's WRAM (scripts-tab host). Pure; null where a term is not known.
// Values follow the VM's arithmetic as far as an index needs it (script-vm expression.ts):
// reads by their width and sign, a flag 0 or 1.

import { Node, Term } from '../script-vm';

/** WRAM address a save- or temp-area term reads (print.ts AREA_BASE); null for the slot's local bytes. */
export function termAddress(t: Term): number | null {
    const base = t.spec.area === 'save' ? 0x2258 : t.spec.area === 'temp' ? 0x2834 : null;
    if (base === null) return null;
    return base + (t.spec.kind === 'flag' ? (t.value ?? 0) >> 3 : t.value ?? 0);
}

/** `byte(addr)`: one WRAM byte, null when unknown. */
export function evaluate(n: Node, byte: (addr: number) => number | null): number | null {
    switch (n.k) {
        case 'const': return n.value;
        case 'read': {
            const t = n.term, at = termAddress(t);
            if (at === null) return null;
            const lo = byte(at);
            if (lo === null) return null;
            if (t.spec.kind === 'flag') return (lo >> ((t.value ?? 0) & 7)) & 1;
            if (t.spec.width === 1) return t.spec.signed && lo & 0x80 ? lo - 0x100 : lo;
            const hi = byte(at + 1);
            if (hi === null) return null;
            const w = lo | (hi << 8);
            return t.spec.signed && w & 0x8000 ? w - 0x10000 : w;
        }
        case 'unary': {
            const a = evaluate(n.arg, byte);
            if (a === null) return null;
            return n.op === '-' ? -a : n.op === '!' ? Number(!a) : n.op === '~' ? ~a : null;
        }
        case 'binary': {
            const a = evaluate(n.left, byte), b = evaluate(n.right, byte);
            if (a === null || b === null) return null;
            switch (n.op) {
                case '+': return a + b; case '-': return a - b; case '*': return a * b;
                case '/': return b ? Math.trunc(a / b) : null;
                case '<<': return a << b; case '>>': return a >> b;
                case '&': return a & b; case '|': return a | b; case '^': return a ^ b;
                default: return null;
            }
        }
        default: return null;
    }
}
