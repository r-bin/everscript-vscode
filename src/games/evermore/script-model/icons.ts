// Ownership: which in-game icon goes with a printed instruction — an enemy it spawns, a loot reward,
// prize item, weapon or dog form it writes or compares with — as references the viewer resolves to
// pictures from the user's ROM (scripts-tab model/icons.ts). Pure; from facts and expression
// trees, never from the text. `find` is the token the printer writes for the value (its name), so
// the viewer can put the icon after it.

import { Instruction, Names, Node, facts, tree } from '../script-vm';

export interface IconRef {
    /** `enemy:<ENEMY>`, `loot:<reward id>`, `weapon:<GAIN_WEAPON>`, `dog:<form>`. */
    key: string;
    /** The printed token the icon follows. */
    find: string;
}

/** The loot reward and the three prize items: reward ids (knowledge ram/7e2391). */
const REWARDS = new Set([0x2391, 0x23a1, 0x23a3, 0x23a5]);

/** What a save-area cell's values are pictures of: rewards (ram/7e2391), the dog's form (ram/7e2443, ram/7e2363), a weapon (ram/7e2441). */
function kindOf(addr: number): string | null {
    if (REWARDS.has(addr)) return 'loot';
    if (addr === 0x2443 || addr === 0x2363) return 'dog';
    if (addr === 0x2441) return 'weapon';
    return null;
}

const SAVE_AREA = 0x2258;

/** The icons an instruction's printed line can show. */
export function iconRefs(ins: Instruction, names: Names): IconRef[] {
    const out: IconRef[] = [];
    const value = (addr: number, v: number): void => {
        const kind = kindOf(addr), name = kind ? names.value?.(addr, v) : '';
        if (kind && name) out.push({ key: `${kind}:${v}`, find: name });
    };
    const f = facts(ins);
    if (f.k === 'spawn') {
        const name = names.enemy?.(f.index);
        if (name) out.push({ key: `enemy:${f.index}`, find: name });
    } else if (f.k === 'write' && f.area === 'save' && f.value !== null) value(f.addr, f.value);
    // A value compared with such a cell: `DOG_READ == WOLF`.
    const visit = (n: Node): void => {
        if (n.k === 'binary') {
            if (n.op === '==' || n.op === '!=') {
                const [r, c] = n.left.k === 'const' ? [n.right, n.left] : [n.left, n.right];
                if (r.k === 'read' && r.term.spec.area === 'save' && c.k === 'const') value(SAVE_AREA + (r.term.value ?? 0), c.value);
            }
            visit(n.left); visit(n.right);
        } else if (n.k === 'unary') visit(n.arg);
    };
    for (const o of ins.operands) if (o.k === 'E') visit(tree(o.expr));
    return out;
}
