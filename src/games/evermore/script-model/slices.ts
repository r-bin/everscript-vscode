// Ownership: the slot's local bytes (`arg[]`) and the room's temp area (`temp[]`, $2834) cut into
// the cells a script uses — each byte or word, with the size it is accessed with and a generic
// name and type for what it holds: `entity_1`, `flags_1`, `byte_1`, `word_1`. Pure.
//
// The local bytes belong to a thread: a call runs in its caller's slot (docs/scripts/vm.md), so a
// thread and everything it calls share one `arg[]`; a started thread has its own. The temp area is
// the room's: every thread shares it. A cell's kind comes from its uses (facts, expression terms):
// `entity` when it is passed where a handler takes an entity (facts ENTITY_FIRST) or is given an
// entity sub-op's value (`arg[0] = last_entity()`), `flags` when its bits are tested or set, else
// `byte` or `word` by its width. A cell used two ways — two widths, bits and a value, two cells
// that overlap — is `reused`: worth a warning, since the name can only say one of them.

import { ENTITY_FIRST, Expression, Instruction, TEMP_AREA, facts, tree } from '../script-vm';

export type SliceArea = 'local' | 'temp';
export type SliceKind = 'entity' | 'flags' | 'byte' | 'word';

export interface Slice {
    area: SliceArea;
    /** The thread whose local bytes these are (a block id, -1 the script itself); -1 for the temp area. */
    thread: number;
    offset: number;
    width: 1 | 2;
    kind: SliceKind;
    /** `arg.entity_1`, `temp.word_2`. */
    name: string;
    /** The instructions that use it. */
    uses: number[];
    /** Why one name cannot say all its uses, or null. */
    reused: string | null;
}

type Use = 'entity' | 'flags' | 'value';
interface Access { area: SliceArea; offset: number; width: 1 | 2; use: Use }

const TEMP_BASE = TEMP_AREA;
/** The temp area's size (print.ts reads cells past it as save-area addresses). */
const TEMP_AREA_SIZE = 200;
/** The sub-ops whose value is an entity record's address (spec.ts: last_entity, script_owner, boy, …). */
const ENTITY_VALUES = new Set(['last_entity', 'script_owner', 'boy', 'dog', 'camera_entity', 'other_character']);

const areaOf = (area: string | undefined, addr: number): { area: SliceArea; offset: number } | null =>
    area === 'local' ? { area: 'local', offset: addr } : area === 'temp' && addr >= TEMP_BASE && addr < TEMP_BASE + TEMP_AREA_SIZE ? { area: 'temp', offset: addr - TEMP_BASE } : null;

/** Every access an expression makes; `entity`: the whole expression is passed as an entity. */
function expressionAccesses(e: Expression, entity: boolean, out: Access[]): void {
    const whole = tree(e);
    for (const t of e.terms) {
        const s = t.spec, v = t.value ?? 0;
        if ((s.kind !== 'read' && s.kind !== 'flag') || (s.area !== 'local' && s.area !== 'temp')) continue;
        const area: SliceArea = s.area;
        if (s.kind === 'flag') { out.push({ area, offset: v >> 3, width: 1, use: 'flags' }); continue; }
        const passed = entity && whole.k === 'read' && whole.term === t;
        out.push({ area, offset: v, width: s.width === 1 ? 1 : 2, use: passed ? 'entity' : 'value' });
    }
}

/** What one instruction reads and writes in the local bytes and the temp area. */
function accessesOf(ins: Instruction): Access[] {
    const out: Access[] = [];
    ins.operands.forEach((o, i) => {
        const entity = i === 0 && ENTITY_FIRST.has(ins.opcode);
        if (o.k === 'E') expressionAccesses(o.expr, entity, out);
        else if (o.k === 'A' || o.k === 'Z') for (const e of o.k === 'A' ? o.args : o.list) expressionAccesses(e, false, out);
    });
    const f = facts(ins);
    if (f.k === 'write') {
        const at = areaOf(f.area, f.addr);
        const value = f.expr ? tree(f.expr) : null;
        const isEntity = value?.k === 'value' && ENTITY_VALUES.has(value.term.spec.name);
        if (at) out.push({ ...at, width: f.width, use: isEntity ? 'entity' : 'value' });
    } else if (f.k === 'flag') {
        const at = areaOf(f.area, f.addr);
        if (at) out.push({ ...at, width: 1, use: 'flags' });
    } else if (f.k === 'tilePair') {
        for (const addr of [f.xAddr, f.yAddr]) { const at = areaOf(f.area, addr); if (at) out.push({ ...at, width: 2, use: 'value' }); }
    }
    return out;
}

/**
 * The slices of `lines`: each instruction with the thread it runs in. `named(addr)` says whether a
 * temp cell already has a name (a knowledge or compiler name), which it keeps.
 */
export function slicesOf(lines: Array<{ ins: Instruction; thread: number }>, named: (addr: number) => boolean): Slice[] {
    const cells = new Map<string, { area: SliceArea; thread: number; offset: number; widths: Set<number>; uses: Set<Use>; at: number[] }>();
    for (const { ins, thread } of lines) {
        for (const a of accessesOf(ins)) {
            if (a.area === 'temp' && named(TEMP_BASE + a.offset)) continue;
            const t = a.area === 'temp' ? -1 : thread;
            const k = `${a.area}:${t}:${a.offset}`;
            let c = cells.get(k);
            if (!c) { c = { area: a.area, thread: t, offset: a.offset, widths: new Set(), uses: new Set(), at: [] }; cells.set(k, c); }
            c.widths.add(a.width);
            c.uses.add(a.use);
            if (!c.at.includes(ins.address)) c.at.push(ins.address);
        }
    }
    const counters = new Map<string, number>();
    const out: Slice[] = [];
    for (const c of cells.values()) {
        const width: 1 | 2 = c.widths.has(2) ? 2 : 1;
        const kind: SliceKind = c.uses.has('entity') ? 'entity' : c.uses.size === 1 && c.uses.has('flags') ? 'flags' : width === 1 ? 'byte' : 'word';
        const why: string[] = [];
        if (c.widths.size > 1) why.push('read as a byte and as a word');
        if (c.uses.has('flags') && c.uses.size > 1) why.push('its bits tested and its value used');
        const ck = `${c.area}:${c.thread}:${kind}`;
        const n = (counters.get(ck) ?? 0) + 1;
        counters.set(ck, n);
        out.push({
            area: c.area, thread: c.thread, offset: c.offset, width, kind, name: `${c.area === 'local' ? 'arg' : 'temp'}.${kind}_${n}`,
            uses: c.at, reused: why.length ? why.join(', ') : null,
        });
    }
    // A word overlaps the cell after it.
    for (const s of out) {
        if (s.width !== 2) continue;
        const next = out.find((o) => o.area === s.area && o.thread === s.thread && o.offset === s.offset + 1);
        if (!next) continue;
        for (const x of [s, next]) x.reused = [x.reused, `overlaps ${x === s ? next.name : s.name}`].filter(Boolean).join(', ');
    }
    return out.sort((a, b) => (a.area === b.area ? 0 : a.area === 'local' ? -1 : 1) || a.thread - b.thread || a.offset - b.offset);
}
