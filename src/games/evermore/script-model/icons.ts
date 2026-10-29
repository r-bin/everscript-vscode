// Ownership: which in-game picture goes with a printed instruction, as references the viewer
// resolves from the user's ROM (scripts-tab model/icons.ts). Pure; from facts, parameter types
// (script-vm parameters.json) and expression terms, never from the text. `find` (and `tail`) is
// the token the printer writes, so the viewer can put the picture after it.
//
//   enemy:<ENEMY>        an enemy a spawn places
//   loot:<reward>        a reward or prize item written or compared with
//   weapon:<index>       a weapon written to or compared with a weapon cell
//   dog:<form>           a dog form written or compared with; `dog()` in a room whose form is known
//   portrait:boy         the Boy's HUD portrait (`boy()`)
//   portrait:dog[:<form>] a Dog form's HUD portrait (`dog()`): the form the listing set, else the room's era's
//   money                a money reward, as the room's era's currency (talons, jewels, gold coins, credits)
//   object:<n>:<state>   room object n in that state (the viewer knows the room)
//   split:<a>|<b>        two pictures side by side, half each: `active()` outside an if that tests it (Boy | Dog), `inactive()` (Dog | Boy)
//   unknown              drawn as ❓: a character the listing cannot tell
//
// What `last_entity()`, `dog()` and an entity cell (`temp.entity_1`) hold depends on what ran
// before: `Context` says (merged.ts tracks it down a listing), and so does who `active()` (the
// controlled one) and `inactive()` are, inside an `if (dog() == active())`. An object index that is an expression gets the
// value the listing set above, if any, and `live`: the viewer asks the running game for it.

import { Instruction, Names, Node, Term, constText, facts, parameters, tree } from '../script-vm';
import { evaluate, termAddress } from './evaluate';

export interface IconRef {
    key: string;
    /** The printed token the picture follows, and what follows it in the text (`()` after a sub-op). */
    find: string;
    /** Search for find starting after this marker in the line (e.g. '=' in an assignment). */
    after?: string;
    tail?: string;
    title?: string;
    /** The picture goes after the bracket that follows `find` (`object[x]`: after the whole object). */
    group?: boolean;
    /** A value read at run time, `<instruction address>:<operand>`: the viewer asks the running game (host `scriptsLive`). */
    live?: string;
}

/** An entity cell the listing names (`temp.entity_1`): its id in `Context.cells` and its printed name. */
export interface EntityCell { id: string; name: string }

/** What the listing knows before the line. */
export interface Context {
    /** The last character a spawn placed (an icon key). */
    last: string | null;
    /** The room's dog form. */
    dog: string;
    /** What each entity cell holds (EntityCell id → icon key). */
    cells: Record<string, string>;
    /** Save- and temp-area words that hold an entity (WRAM address → icon key): what the listing put there, and what the enter script left for a trigger. */
    saved: Record<number, string>;
    /** Save- and temp-area bytes the listing set to a constant (WRAM address → byte). */
    known: Record<number, number>;
    /** Who `active()` is here, when an if around the line tests it (merged.ts); null: the listing cannot tell. */
    active?: 'boy' | 'dog' | null;
    /** The entity cell a local or temp read names in this line's thread, or null. */
    cell?(area: 'local' | 'temp', offset: number): EntityCell | null;
}

export const fresh = (saved: Record<number, string> = {}): Context => ({ last: null, dog: 'portrait:dog', cells: {}, saved: { ...saved }, known: {} });

/** LOOT_REWARD MONEY: the amount is in the era's currency. */
const MONEY = 0x0001;
const LOOT_OBJECT = 0x2395;

/** The loot reward and the three prize items: reward ids (knowledge ram/7e2391). */
const REWARDS = new Set([0x2391, 0x23a1, 0x23a3, 0x23a5]);

/** What a save-area cell's values are pictures of: rewards (ram/7e2391), the dog's form (ram/7e2443, ram/7e2363), a weapon (ram/7e2441, ram/7e235f). */
function kindOf(addr: number): string | null {
    if (REWARDS.has(addr)) return 'loot';
    if (addr === LOOT_OBJECT) return 'object';
    if (addr === 0x2443 || addr === 0x2363) return 'dog';
    if (addr === 0x2441 || addr === 0x235f) return 'weapon';
    if (addr === 0x2348) return 'currency';
    return null;
}

const SAVE_AREA = 0x2258;
const COMPARISONS = new Set(['==', '!=', '<', '>', '<=', '>=']);

/** The entity sub-ops (spec.ts) and the picture each stands for. */
function characterRef(t: Term, ctx: Context): IconRef | null {
    const name = t.spec.name;
    switch (name) {
        case 'boy': return { key: 'portrait:boy', find: name, tail: '()', title: 'the Boy' };
        case 'dog': return { key: ctx.dog, find: name, tail: '()', title: ctx.dog === 'portrait:dog' ? 'the Dog, in the form of the era the room is in' : 'the Dog, in the form the listing asks for above' };
        case 'active': case 'inactive': {
            // The one the player controls (the camera follows it) and the other: known only inside an if that tests it.
            const who = ctx.active ? (name === 'active' ? ctx.active : ctx.active === 'boy' ? 'dog' : 'boy') : null;
            const what = name === 'active' ? 'the character the player controls' : 'the character the player does not control';
            // Not known: both, split — the controlled one's side first (active: Boy | Dog, inactive: Dog | Boy).
            if (!who) return { key: name === 'active' ? `split:portrait:boy|${ctx.dog}` : `split:${ctx.dog}|portrait:boy`, find: name, tail: '()', title: `${what}: the Boy or the Dog, whichever the player switched to` };
            return { key: who === 'boy' ? 'portrait:boy' : ctx.dog, find: name, tail: '()', title: `${what}: the ${who === 'boy' ? 'Boy' : 'Dog'}, as the if around this line tests` };
        }
        case 'last_entity': return ctx.last
            ? { key: ctx.last, find: name, tail: '()', title: 'the last character a spawn placed above this line' }
            : { key: 'unknown', find: name, tail: '()', title: 'the last character a spawn placed: none above this line, so it comes from before the script' };
        case 'script_owner': return { key: 'unknown', find: name, tail: '()', title: 'the character running this script: the listing cannot tell which' };
        default: return null;
    }
}

/** The pictures an instruction's printed line can show. */
export function iconRefs(ins: Instruction, names: Names, ctx: Context = fresh()): IconRef[] {
    const out: IconRef[] = [];
    const value = (addr: number, v: number): void => {
        if (addr === LOOT_OBJECT) {
            const valStr = names.decimal ? String(v) : constText(v);
            out.push({ key: `object:${v}:0`, find: valStr, title: `object ${v}, first state` });
            return;
        }
        const kind = kindOf(addr), name = kind ? names.value?.(addr, v) : '';
        if (kind === 'currency') {
            const idx = v >= 0 && v < 4 ? v : Math.floor(v / 3);
            const cname = name || names.constant?.('CURRENCY', v);
            if (cname) out.push({ key: `currency:${idx}`, find: cname, title: cname.toLowerCase() });
            return;
        }
        if (kind && name) out.push({ key: kind === 'loot' && v === MONEY ? 'money' : `${kind}:${v}`, find: name, ...(v === MONEY && kind === 'loot' ? { title: 'money, in the currency of the era the room is in' } : {}) });
    };
    const f = facts(ins);
    if (f.k === 'spawn') {
        const name = names.enemy?.(f.index);
        if (name) out.push({ key: `enemy:${f.index}`, find: name });
    } else if (f.k === 'write' && f.area === 'save') {
        if (f.value !== null) value(f.addr, f.value);
        else if (f.addr === LOOT_OBJECT && f.expr) {
            const v = evaluate(tree(f.expr), (a) => ctx.known[a] ?? null);
            if (v !== null) value(f.addr, v);
            else out.push({ key: 'unknown', find: names.memory?.(f.addr) || 'MAP_REF', live: `${ins.address}:1`, title: 'an object the game picks at run time (first state)' });
        }
    }
    // A value compared with such a cell (`DOG_READ == WOLF`, `CURRENT_WEAPON >= BRONZE_AXE`); the characters.
    const visit = (n: Node): void => {
        if (n.k === 'binary') {
            if (COMPARISONS.has(n.op)) {
                const [r, c] = n.left.k === 'const' ? [n.right, n.left] : [n.left, n.right];
                if (r.k === 'read' && r.term.spec.area === 'save' && c.k === 'const') value(SAVE_AREA + (r.term.value ?? 0), c.value);
            }
            visit(n.left); visit(n.right);
        } else if (n.k === 'unary') visit(n.arg);
        else if (n.k === 'value') add(characterRef(n.term, ctx));
        else if (n.k === 'read') add(cellRef(n.term, ctx, names));
    };
    const add = (c: IconRef | null): void => { if (c && !out.some((o) => o.find === c.find)) out.push(c); };
    const params = parameters(ins.opcode);
    ins.operands.forEach((o, i) => {
        if (o.k !== 'E') return;
        const n = tree(o.expr);
        if (params[i]?.type === 'object_index') out.push(objectRef(ins, i, n, ctx, names));
        if (params[i]?.enum === 'CURRENCY') {
            const v = n.k === 'const' ? n.value : evaluate(n, (a) => ctx.known[a] ?? null);
            if (v !== null) {
                const cname = names.constant?.('CURRENCY', v) || (names.decimal ? String(v) : constText(v));
                const idx = v >= 0 && v < 4 ? v : Math.floor(v / 3);
                out.push({
                    key: `currency:${idx}`,
                    find: cname,
                    title: names.constant?.('CURRENCY', v)?.toLowerCase() ?? 'currency',
                });
            }
        }
        if (params[i]?.enum === 'ALCHEMY_INDEX' || params[i]?.enum === 'CAST') {
            const v = n.k === 'const' ? n.value : evaluate(n, (a) => ctx.known[a] ?? null);
            if (v !== null) {
                const ename = params[i]!.enum!;
                const aname = names.constant?.(ename, v) || (names.decimal ? String(v) : constText(v));
                out.push({
                    key: `${ename === 'CAST' ? 'cast' : 'alchemy'}:${v}`,
                    find: aname,
                    title: names.constant?.(ename, v)?.toLowerCase() ?? 'alchemy',
                });
            }
        }
        if (ins.opcode === 0x5C && i === 1) {
            const op0 = ins.operands[0];
            const objNode = op0?.k === 'E' ? tree(op0.expr) : null;
            const objId = objNode?.k === 'const' ? objNode.value : objNode ? evaluate(objNode, (a) => ctx.known[a] ?? null) : null;
            const stVal = n.k === 'const' ? n.value : evaluate(n, (a) => ctx.known[a] ?? null);
            if (objId !== null && stVal !== null) {
                const isLast = (stVal & 0x7fff) === 0x7e || (stVal & 0x7fff) === 0x7f;
                const clamped = isLast ? 'last' : (stVal & 0x80 ? 0 : stVal & 0x7fff);
                const stName = names.constant?.('OBJECT_STATE', stVal) || (names.decimal ? String(stVal) : constText(stVal));
                out.push({
                    key: `object:${objId}:${clamped}`,
                    find: stName,
                    after: '=',
                    title: `object ${objId}, ${stateText(stVal)}`,
                });
            }
        }
        visit(n);
    });
    return out;
}

/** The forms printed `object[x]` (print.ts); the others are calls that take the index. */
const SUBSCRIPT = new Set([0x5C, 0x5F, 0x60, 0x61]);

/**
 * A room object by its index, in the state the line sets it to (`object[2] = 9`), else its first.
 * An index the line computes is the value the listing set above, if any (else `unknown`), and is
 * read live from the running game.
 */
function objectRef(ins: Instruction, i: number, n: Node, ctx: Context, names: Names): IconRef {
    const state = objectState(ins);
    const subscript = SUBSCRIPT.has(ins.opcode);
    if (n.k === 'const') {
        // `object[3]`: after the whole object; a call (`object_state_by_flag(9, 0x03cc)`): after the id, as the line prints it.
        const at = subscript ? { find: 'object', group: true } : { find: names.decimal ? String(n.value) : constText(n.value) };
        return { key: `object:${n.value}:${state}`, ...at, title: `object ${n.value}, ${stateText(state)}` };
    }
    const v = evaluate(n, (a) => ctx.known[a] ?? null);
    return {
        key: v === null ? 'unknown' : `object:${v}:${state}`, find: subscript ? 'object' : ins.spec.name, group: true, live: `${ins.address}:${i}`,
        title: v === null ? `an object the game picks at run time (${stateText(state)})` : `object ${v}, ${stateText(state)}: the index the listing set above`,
    };
}

/**
 * The state an object line shows: the one `object[x] = s` sets, else the first. As `$90:A36D` reads
 * it (docs/map-format/map_objects.md §4c): bit 15 only skips the holds, bit 7 means 0, and a value
 * above the last state (`$7E`, `$7F`) is the last — the picture clamps it.
 */
function objectState(ins: Instruction): number {
    if (ins.opcode === 0x5C) return 0;
    const o1 = ins.operands[1];
    const s = o1?.k === 'E' ? tree(o1.expr) : null;
    const v = s && s.k === 'const' ? s.value & 0x7fff : 0;
    return v & 0x80 ? 0 : v;
}

const stateText = (s: number): string => (s >= 0x7e ? 'its last state' : `state ${s}`);

/** The WRAM bytes operand `i` reads (a word per term: the viewer reads them from the running game). */
export function liveCells(ins: Instruction, i: number): number[] {
    const o = ins.operands[i];
    if (!o || o.k !== 'E') return [];
    return o.expr.terms.map(termAddress).filter((a): a is number => a !== null).flatMap((a) => [a, a + 1]);
}

/** Operand `i`'s object, its index computed from `byte` (WRAM read from the running game), as an icon key; null when unknown. */
export function liveObjectKey(ins: Instruction, i: number, byte: (addr: number) => number | null): string | null {
    const o = ins.operands[i];
    const v = o && o.k === 'E' ? evaluate(tree(o.expr), byte) : null;
    return v === null ? null : `object:${v}:${objectState(ins)}`;
}

/**
 * An entity cell read: a sliced one (`temp.entity_1`) shows what it was given above, else unknown;
 * a save- or temp-area word shows the entity written to it, here or by the enter script (`<0x24d7>`
 * the lift), and nothing when none was.
 */
function cellRef(t: Term, ctx: Context, names: Names): IconRef | null {
    if (t.spec.kind !== 'read' || t.spec.width !== 2) return null;
    const at = termAddress(t);
    const held = at !== null ? ctx.saved[at] : undefined;
    const c = t.spec.area === 'local' || t.spec.area === 'temp' ? ctx.cell?.(t.spec.area, t.value ?? 0) : null;
    if (c) {
        const key = ctx.cells[c.id] ?? held;
        return { key: key ?? 'unknown', find: c.name, title: key ? `what ${c.name} was given above this line` : `${c.name}: nothing gave it a character above this line` };
    }
    if (at === null || !held) return null;
    const name = names.memory?.(at) || `<0x${at.toString(16).padStart(4, '0')}>`;
    return { key: held, find: name, title: `what ${name} holds: written above, or by the room's enter script` };
}

/** The picture an entity value stands for (`last_entity()`, `boy()`, an entity cell), for a cell it is written to; null for a value that is no entity. */
export function entityKey(n: Node, ctx: Context, names: Names = {}): string | null {
    if (n.k === 'value') return characterRef(n.term, ctx)?.key ?? null;
    if (n.k === 'read') return cellRef(n.term, ctx, names)?.key ?? null;
    return null;
}

/** The context after the line: a spawn that places a character now (not a spawner record) is `last_entity()` (opcodes/3c); a dog form request is the room's form. */
export function after(ins: Instruction, ctx: Context): Context {
    const f = facts(ins);
    if (f.k === 'spawn' && !f.spawner) return { ...ctx, last: `enemy:${f.index}` };
    if (f.k !== 'write' || f.area === 'local') return ctx;
    const known = { ...ctx.known };
    for (let b = 0; b < f.width; b++) {
        if (f.value === null) delete known[f.addr + b];
        else known[f.addr + b] = (f.value >> (8 * b)) & 0xff;
    }
    const next = { ...ctx, known };
    if (f.area === 'save' && f.addr === 0x2443 && f.value) next.dog = `portrait:dog:${f.value}`;
    return next;
}
