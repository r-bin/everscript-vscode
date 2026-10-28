// Ownership: which in-game picture goes with a printed instruction, as references the viewer
// resolves from the user's ROM (scripts-tab model/icons.ts). Pure; from facts, parameter types
// (script-vm parameters.json) and expression terms, never from the text. `find` (and `tail`) is
// the token the printer writes, so the viewer can put the picture after it.
//
//   enemy:<ENEMY>        an enemy a spawn places
//   loot:<reward>        a reward or prize item written or compared with
//   weapon:<index>       a weapon written to or compared with a weapon cell
//   dog:<form>           a dog form written or compared with; `dog()` in a room whose form is known
//   char:<record>        a character's first frame: `boy()` the Boy (0), `dog()` the Dog (1)
//   object:<n>:<state>   room object n in that state (the viewer knows the room)
//
// What `last_entity()` and `dog()` hold depends on what ran before: `Context` says (merged.ts
// tracks it down a listing). `camera_entity()` is taken to be the Boy and `other_character()`
// the Dog — the usual case, said so in the title.

import { Instruction, Names, Node, Term, constText, facts, parameters, tree } from '../script-vm';

export interface IconRef {
    key: string;
    /** The printed token the picture follows, and what follows it in the text (`()` after a sub-op). */
    find: string;
    tail?: string;
    title?: string;
}

/** What the listing knows before the line: the last enemy spawned, the room's dog form. */
export interface Context { last: string | null; dog: string }

const FRESH: Context = { last: null, dog: 'char:1' };

/** The loot reward and the three prize items: reward ids (knowledge ram/7e2391). */
const REWARDS = new Set([0x2391, 0x23a1, 0x23a3, 0x23a5]);

/** What a save-area cell's values are pictures of: rewards (ram/7e2391), the dog's form (ram/7e2443, ram/7e2363), a weapon (ram/7e2441, ram/7e235f). */
function kindOf(addr: number): string | null {
    if (REWARDS.has(addr)) return 'loot';
    if (addr === 0x2443 || addr === 0x2363) return 'dog';
    if (addr === 0x2441 || addr === 0x235f) return 'weapon';
    return null;
}

const SAVE_AREA = 0x2258;
const COMPARISONS = new Set(['==', '!=', '<', '>', '<=', '>=']);

/** The entity sub-ops (spec.ts) and the picture each stands for. */
function characterRef(t: Term, ctx: Context): IconRef | null {
    const name = t.spec.name;
    switch (name) {
        case 'boy': return { key: 'char:0', find: name, tail: '()', title: 'the Boy' };
        case 'dog': return { key: ctx.dog, find: name, tail: '()', title: 'the Dog, in the form the room gives it' };
        case 'camera_entity': return { key: 'char:0', find: name, tail: '()', title: 'the character the camera follows: the Boy, unless the player switched' };
        case 'other_character': return { key: ctx.dog, find: name, tail: '()', title: 'the character not followed: the Dog, unless the player switched' };
        case 'last_entity': return ctx.last ? { key: ctx.last, find: name, tail: '()', title: 'the last character a spawn placed above this line' } : null;
        default: return null;
    }
}

/** The pictures an instruction's printed line can show. */
export function iconRefs(ins: Instruction, names: Names, ctx: Context = FRESH): IconRef[] {
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
    // A value compared with such a cell (`DOG_READ == WOLF`, `CURRENT_WEAPON >= BRONZE_AXE`); the characters.
    const visit = (n: Node): void => {
        if (n.k === 'binary') {
            if (COMPARISONS.has(n.op)) {
                const [r, c] = n.left.k === 'const' ? [n.right, n.left] : [n.left, n.right];
                if (r.k === 'read' && r.term.spec.area === 'save' && c.k === 'const') value(SAVE_AREA + (r.term.value ?? 0), c.value);
            }
            visit(n.left); visit(n.right);
        } else if (n.k === 'unary') visit(n.arg);
        else if (n.k === 'value') { const c = characterRef(n.term, ctx); if (c && !out.some((o) => o.find === c.find)) out.push(c); }
    };
    // A room object by its index: the state the line sets it to (`object[2] = 9`), else its first.
    const params = parameters(ins.opcode);
    ins.operands.forEach((o, i) => {
        if (o.k !== 'E') return;
        const n = tree(o.expr);
        if (params[i]?.type === 'object_index' && n.k === 'const') {
            const o1 = ins.operands[1];
            const s = ins.opcode === 0x5C && o1?.k === 'E' ? tree(o1.expr) : null;
            const state = s && s.k === 'const' ? s.value : 0;
            out.push({ key: `object:${n.value}:${state}`, find: constText(n.value), title: `object ${n.value}, state ${state}` });
        }
        visit(n);
    });
    return out;
}

/** The context after the line: a spawn that places a character now (not a spawner record) is `last_entity()` (opcodes/3c); a dog form request is the room's form. */
export function after(ins: Instruction, ctx: Context): Context {
    const f = facts(ins);
    if (f.k === 'spawn' && !f.spawner) return { ...ctx, last: `enemy:${f.index}` };
    if (f.k === 'write' && f.area === 'save' && f.addr === 0x2443 && f.value) return { ...ctx, dog: `dog:${f.value}` };
    return ctx;
}
