// Ownership: a script as one listing with what it calls merged in — read the way the interpreter
// runs it (docs/scripts/vm.md, "Flow"). Pure.
//
// When each runs is the scheduler's (knowledge rom/8ccffd.md): a call puts the callee in the
// caller's place in the same pass, so its body follows the call line. A start (`call_async`)
// appends a thread to the run list and the starter carries on; the new thread first runs once the
// starter's turn is over, so its body follows the next line that ends the turn — a sleep, a
// yield, a wait — even inside a callee, or the end of the starter's thread. A call does not end
// the turn, and neither does the end of a called script (the caller resumes in the same pass).
//
// Each script reads as structured code (structure.ts): `if (…) { } else if (…) { } else { }` and
// `while (…) { }` recovered from its branches and jumps, the lines indented by them. A called body
// sits as deep as its call line (the call is a fold, not a block of its own); a started thread's
// sits one deeper. `flat` is the indent without the structured listing, for a viewer that shows
// the instructions as printed (`raw`, no braces).
//
// Each merged body is a block the viewer can fold. A callee named by a global id (u8) or a trigger
// offset (u16) — printed by its name, `call_id(NAME)` — is a shared helper and starts folded; one
// printed by its address (a full pointer, or a bank-relative call back) starts open, arguments or not. A callee already being merged further up is not merged
// again (recursion), and the listing stops merging past MAX_LINES, so nothing here can run away.
//
// Each block has a `role`, what it is for, from its instructions' facts (never their text) and
// those of everything it calls (`roleOf`): an `exit` changes the map, a `sniff` spot or a `loot`
// pickup calls the game's loot drivers (globals $39, $3A/$3B, loot.ts) or stages a reward, a
// `cutscene` shows text or plays animations. The enter script's own lines are the room's `init`.
//
// `arg[]` and `temp[]` are sliced (slices.ts): the listing is merged once to learn which thread
// each line runs in, then printed again with each cell's slice name (`arg.entity_1`); a line that
// uses a reused cell gets a warning.

import { Instruction, Names, ScriptRom, TEMP_AREA, decodeAt, facts, roomScripts, tree, walk } from '../script-vm';
import { LOOT_CELLS } from './loot';
import { Slice, slicesOf } from './slices';
import { Context, after, entityKey, fresh, iconRefs } from './icons';
import { ScriptRow, row } from './room-model';
import { printNames, displayNames } from './names';
import { structure } from './structure';
import { hiromFileOffset } from '../../../platform/snes/hirom';
import { dialogueText } from '../localizations';

/** Past this many lines no more bodies are merged in. */
const MAX_LINES = 4000;

export interface MergedLine extends ScriptRow {
    /** The block this line belongs to (innermost), -1 for the script itself. */
    in: number;
    /** How deep to draw it: the ifs and loops around it in its script, plus where its block sits. */
    indent: number;
    /** How deep to draw it without the structured listing: only the threads it runs in. */
    flat: number;
    /** The block this line heads: a call's body, or a started thread's. */
    opens?: number;
    /** A line that is not an instruction: where a thread joins, why a body is not merged. */
    note?: boolean;
    /** A brace of the structured listing (`}`, `while (true) {`): no instruction of its own. */
    brace?: boolean;
    /** The instruction as printed, when the structured listing says it differently (`if (c) {` for `if! (c) goto …`). */
    raw?: string;
    /** The thread it runs in: the block id of the started thread, -1 for the script's own. */
    thread: number;
}

export interface MergedBlock {
    id: number;
    parent: number;
    kind: 'call' | 'thread';
    /** The script merged in. */
    target: number;
    /** Where it was called or started from. */
    from: number;
    /** Starts folded: a shared helper, named by a global id or a trigger offset. */
    folded: boolean;
    /** How many lines it holds, its own blocks' included. */
    size: number;
    /** What it is for (`roleOf`), null when nothing says. */
    role: Role | null;
}

export interface MergedScript {
    entry: number; lines: MergedLine[]; blocks: MergedBlock[]; slices: Slice[];
    /** The save- and temp-area words holding an entity when the listing ends (WRAM address → icon key): the enter script's seed a trigger's listing. */
    entities: Record<number, string>;
}

/** What a script is for: the room's setup, a door out, a pickup, a sniff spot, a scene. */
export type Role = 'init' | 'exit' | 'loot' | 'sniff' | 'cutscene';

/** The loot drivers (loot.ts): $39 the sniff spot's, $3A / $3B the gourd's and the chest's. */
const SNIFF_DRIVER = 0x39, LOOT_DRIVERS = new Set([0x3A, 0x3B]);
/** Play an animation, walk a character: what a scene does with the characters. */
const SCENE_OPCODES = new Set([0x6C, 0x6D, 0x73, 0x78, 0x79, 0x9D]);

/**
 * What the script at `entry` is for, with everything it calls and starts: an exit before a pickup,
 * a pickup before a scene (a pickup shows text too); null when it does none of these.
 */
export function roleOf(rom: ScriptRom, entry: number): Role | null {
    let w;
    try { w = walk(rom, [entry], true); } catch { return null; }
    const seen = new Set<Role>();
    for (const ins of w.instructions.values()) {
        const f = facts(ins);
        if (f.k === 'changeMap') seen.add('exit');
        else if (f.k === 'call' && f.global === SNIFF_DRIVER) seen.add('sniff');
        else if ((f.k === 'call' && f.global !== null && LOOT_DRIVERS.has(f.global)) || (f.k === 'write' && f.area === 'save' && LOOT_CELLS.has(f.addr))) seen.add('loot');
        else if (f.k === 'text' || SCENE_OPCODES.has(ins.opcode)) seen.add('cutscene');
    }
    return (['exit', 'sniff', 'loot', 'cutscene'] as Role[]).find((r) => seen.has(r)) ?? null;
}


/** The script at `entry`, with every call and start merged in, `arg[]` and `temp[]` sliced. */
export function mergedScript(rom: ScriptRom, entry: number, names: Names = printNames(hiromFileOffset), entities: Record<number, string> = {}): MergedScript {
    const seen: Array<{ ins: Instruction; thread: number }> = [];
    mergeOnce(rom, entry, names, null, seen);
    const slices = slicesOf(seen, (addr) => !!names.memory?.(addr));
    const out = mergeOnce(rom, entry, names, slices, []);
    const reused = new Map<number, Slice[]>();
    for (const sl of slices) if (sl.reused) for (const at of sl.uses) reused.set(at, [...(reused.get(at) ?? []), sl]);
    for (const line of out.lines) {
        if (line.note || line.brace) continue;
        for (const sl of reused.get(line.addressSnes) ?? []) {
            if (sl.area === 'local' && sl.thread !== line.thread) continue;
            line.marks = [...(line.marks ?? []), { severity: 'warning', find: sl.name, nth: 0, message: `${sl.name} is reused: ${sl.reused}. One name cannot say what it holds.` }];
        }
    }
    const left = inferIcons(rom, out.lines, slices, names, entities);
    return { ...out, slices, entities: left };
}

/**
 * The pictures each line shows, with what the listing knows before it (icons.ts Context): read
 * down the listing in order — the way it runs, branches and threads aside — so `last_entity()`
 * is the last spawn above and `dog()` the form the room asked for. An entity cell keeps what it
 * was last given (`temp.entity_1 = last_entity()`), for the lines that read it; its slice lists
 * every character it is given.
 */
function inferIcons(rom: ScriptRom, lines: MergedLine[], slices: Slice[], names: Names, seed: Record<number, string>): Record<number, string> {
    let ctx: Context = fresh(seed);
    const played = placeholderAnimations(rom, lines, names);
    const sliceOf = (area: 'local' | 'temp', offset: number, thread: number): Slice | undefined =>
        slices.find((x) => x.area === area && x.offset === offset && (area === 'temp' || x.thread === thread));
    // Who `active()` is, from the ifs around the line (`if (dog() == active()) {`: the Dog; its `else`: the Boy).
    const sides: Array<{ indent: number; who: 'boy' | 'dog' }> = [];
    for (const line of lines) {
        if (line.note) continue;
        const otherwise = /^\} else\b/.test(line.summary);
        while (sides.length && line.indent <= sides[sides.length - 1].indent && !(otherwise && line.indent === sides[sides.length - 1].indent)) sides.pop();
        const top = sides[sides.length - 1];
        if (otherwise && top && line.indent === top.indent) {
            sides.pop();
            if (!/^\} else if /.test(line.summary)) sides.push({ indent: top.indent, who: top.who === 'boy' ? 'dog' : 'boy' });
        }
        // The head itself reads active() outside its own test.
        const here = sides.length ? sides[sides.length - 1].who : null;
        const side = activeTest(line.summary);
        if (side) sides.push({ indent: line.indent, who: side });
        if (line.brace) continue;
        ctx.active = here;
        let ins: Instruction;
        try { ins = decodeAt(rom, line.addressSnes); } catch { continue; }
        ctx.cell = (area, offset) => {
            const s = sliceOf(area, offset, line.thread);
            return s && s.kind === 'entity' ? { id: `${s.area}:${s.thread}:${s.offset}`, name: s.name } : null;
        };
        const anim = played.get(line.addressSnes);
        const refs = iconRefs(ins, names, ctx).map((r) => (anim && r.key.startsWith('enemy:') ? { ...r, key: anim, title: 'a placeholder, drawn as the animation it is given below' } : r));
        if (refs.length) line.icons = refs; else delete line.icons;
        const f = facts(ins);
        if (f.k === 'write' && f.expr) {
            const key = entityKey(tree(f.expr), ctx, names);
            const s = f.area !== 'save' ? sliceOf(f.area, f.area === 'local' ? f.addr : f.addr - TEMP_AREA, line.thread) : undefined;
            if (s && s.kind === 'entity') {
                ctx = { ...ctx, cells: { ...ctx.cells, [`${s.area}:${s.thread}:${s.offset}`]: key ?? 'unknown' } };
                if (key && key !== 'unknown' && !(s.icons ??= []).includes(key)) s.icons.push(key);
            }
            // A save- or temp-area word given an entity holds it for the lines below, and for the room's triggers.
            if (f.area !== 'local' && f.width === 2) {
                const saved = { ...ctx.saved };
                if (key && key !== 'unknown') saved[f.addr] = key; else delete saved[f.addr];
                ctx = { ...ctx, saved };
            }
        } else if (f.k === 'write' && f.area !== 'local' && f.addr in ctx.saved) {
            const saved = { ...ctx.saved };
            delete saved[f.addr];
            ctx = { ...ctx, saved };
        }
        const dog = ctx.dog;
        ctx = after(ins, ctx);
        // A dog form set inside a branch is one act's of several (an enter script per act): the room's era decides instead.
        if (line.indent > 0) ctx = { ...ctx, dog };
        if (anim && f.k === 'spawn' && !f.spawner) ctx = { ...ctx, last: anim };
    }
    return ctx.saved;
}

/** `animate` and `animate_and_wait`: entity, animation id, mode. */
const ANIMATE = new Set([0x78, 0x79]);

/**
 * Each placeholder spawn (the PLACEHOLDER record: an invisible stand-in a script animates) and the
 * animation the lines after it give it (`animate(last_entity(), LIFT_MOVING, …)`, or through a
 * cell `last_entity()` was written to), as an icon key `anim:<id>`; up to the next spawn.
 */
function placeholderAnimations(rom: ScriptRom, lines: MergedLine[], names: Names): Map<number, string> {
    const out = new Map<number, string>();
    const code = lines.filter((l) => !l.note && !l.brace);
    code.forEach((line, i) => {
        let ins: Instruction;
        try { ins = decodeAt(rom, line.addressSnes); } catch { return; }
        const f = facts(ins);
        if (f.k !== 'spawn' || f.spawner || names.enemy?.(f.index) !== 'PLACEHOLDER') return;
        const holds = new Set<string>();
        for (const next of code.slice(i + 1)) {
            let n: Instruction;
            try { n = decodeAt(rom, next.addressSnes); } catch { continue; }
            const g = facts(n);
            if (g.k === 'spawn') break;
            if (g.k === 'write' && g.expr) {
                const v = tree(g.expr);
                if (v.k === 'value' && v.term.spec.name === 'last_entity') holds.add(`${g.area}:${g.addr}`);
            }
            const o0 = n.operands[0], o1 = n.operands[1];
            if (!ANIMATE.has(n.opcode) || o0?.k !== 'E' || o1?.k !== 'u16') continue;
            const who = tree(o0.expr);
            const mine = (who.k === 'value' && who.term.spec.name === 'last_entity')
                || (who.k === 'read' && holds.has(`${who.term.spec.area}:${who.term.spec.area === 'local' ? who.term.value : (who.term.spec.area === 'temp' ? TEMP_AREA : 0x2258) + (who.term.value ?? 0)}`));
            if (mine) { out.set(line.addressSnes, `anim:${o1.value}`); break; }
        }
    });
    return out;
}

/** A call that names its script by a global id or a trigger offset (`call_id(NAME)`, `call_trigger(NAME)`): the only calls that start folded; one printed by its address stays open. */
function shortCall(ins: Instruction): boolean {
    const f = facts(ins);
    return f.k === 'call' && (f.global !== null || f.trigger !== null);
}

/** `if (dog() == active()) {` (either side, `!=` the other way): who is active inside the if; null for another head. */
function activeTest(summary: string): 'boy' | 'dog' | null {
    const m = /^(?:\} else )?if \((boy|dog|active)\(\) (==|!=) (boy|dog|active)\(\)\) \{$/.exec(summary);
    if (!m || (m[1] === 'active') === (m[3] === 'active')) return null;
    const who = (m[1] === 'active' ? m[3] : m[1]) as 'boy' | 'dog';
    return m[2] === '==' ? who : who === 'boy' ? 'dog' : 'boy';
}

/** One merge of the script at `entry`; `slices` names the cells (null: plain `arg[n]`), `seen` collects each instruction with its thread. */
function mergeOnce(rom: ScriptRom, entry: number, names: Names, slices: Slice[] | null, seen: Array<{ ins: Instruction; thread: number }>): { entry: number; lines: MergedLine[]; blocks: MergedBlock[] } {
    const lines: MergedLine[] = [];
    const blocks: MergedBlock[] = [];

    /** How deep a script's lines sit: structured (`s`) and flat (`f`). */
    type Base = { s: number; f: number };
    const deeper = (b: Base): Base => ({ s: b.s + 1, f: b.f + 1 });
    const threadOf = (block: number): number => {
        for (let b = block; b >= 0; b = blocks[b].parent) if (blocks[b].kind === 'thread') return b;
        return -1;
    };
    const note = (at: number, depth: number, at2: Base, block: number, summary: string): MergedLine => ({
        addressSnes: at, opcode: -1, opcodeHex: '', size: 0, bytesHex: '', summary, terminal: false, untraced: false,
        unsupported: false, depth, indent: at2.s, flat: at2.f, in: block, note: true, thread: threadOf(block),
    });
    /** The names for a line in `thread`: its own local slices, the room's temp slices. */
    const namesIn = (thread: number): Names => {
        if (!slices) return names;
        const find = (area: 'local' | 'temp', offset: number): string => slices.find((x) => x.area === area && x.offset === offset && (area === 'temp' || x.thread === thread))?.name ?? '';
        return { ...names, slice: (area, offset) => find(area, offset) };
    };

    function open(kind: MergedBlock['kind'], ins: Instruction, parent: number): MergedBlock {
        const b: MergedBlock = { id: blocks.length, parent, kind, target: ins.target!, from: ins.address, folded: kind === 'call' && shortCall(ins), size: 0, role: roleOf(rom, ins.target!) };
        blocks.push(b);
        return b;
    }

    /**
     * One script's lines at `depth`, inside `block`; `stack` the scripts being merged above it.
     * `waiting` is the thread's starts that have not had a turn yet: shared with the scripts it
     * calls (same thread), joined in where the turn ends.
     */
    function body(at: number, depth: number, base: Base, block: number, stack: number[], waiting: Instruction[]): void {
        const list = [...walk(rom, [at], false).instructions.values()].sort((a, b) => a.address - b.address);
        const thread = threadOf(block);
        const printed = list.map((ins) => row(rom, ins, namesIn(thread)));
        for (const ins of list) seen.push({ ins, thread });
        let here = base;
        const join = (): void => {
            for (const s of waiting.splice(0)) {
                const b = open('thread', s, block);
                const head = note(s.address, depth, here, block, `∥ thread $${hex6(s.target!)} runs alongside from here (started at $${hex6(s.address)})`);
                head.opens = b.id;
                lines.push(head);
                merge(b, s.target!, depth + 1, deeper(here), stack, []);
            }
        };
        for (const r of structure(list, printed.map((p) => p.summary))) {
            here = { s: base.s + r.depth, f: base.f };
            if (r.kind === 'brace') {
                lines.push({ ...note(-1, depth, here, block, r.text), note: false, brace: true });
                continue;
            }
            const ins = list[r.index];
            const line: MergedLine = { ...printed[r.index], depth, indent: here.s, flat: here.f, in: block, thread };
            if (r.text !== undefined) { line.raw = line.summary; line.summary = r.text; }
            lines.push(line);
            if (ins.flow === 'call' && ins.target !== null && rom.contains(ins.target)) {
                const b = open('call', ins, block);
                lines[lines.length - 1].opens = b.id;
                merge(b, ins.target, depth + 1, here, stack, []);
            }
            if (ins.flow === 'start' && ins.target !== null && rom.contains(ins.target)) waiting.push(ins);
            if (ins.flow === 'yield') join();
        }
    }

    /** Merge `target` into block `b`; a thread's own body ends its turn, so what it started joins at its end. */
    function merge(b: MergedBlock, target: number, depth: number, base: Base, stack: number[], waiting: Instruction[]): void {
        const start = lines.length;
        if (stack.includes(target)) lines.push(note(target, depth, base, b.id, `↻ $${hex6(target)} is already running above: not merged again`));
        else if (lines.length > MAX_LINES) lines.push(note(target, depth, base, b.id, `… $${hex6(target)} not merged: the listing is long enough`));
        else body(target, depth, base, b.id, [...stack, target], waiting);
        if (b.kind === 'thread' || b.kind === 'call') joinAtEnd(waiting, depth, base, b.id, stack);
        b.size = lines.length - start;
    }

    /** What a thread started and never yielded after runs once the thread is over. */
    function joinAtEnd(waiting: Instruction[], depth: number, base: Base, block: number, stack: number[]): void {
        for (const s of waiting.splice(0)) {
            const b = open('thread', s, block);
            const head = note(s.address, depth, base, block, `∥ thread $${hex6(s.target!)} runs from here, after the thread that started it (at $${hex6(s.address)})`);
            head.opens = b.id;
            lines.push(head);
            merge(b, s.target!, depth + 1, deeper(base), stack, []);
        }
    }

    if (rom.contains(entry)) {
        try {
            decodeAt(rom, entry);
            const waiting: Instruction[] = [];
            body(entry, 0, { s: 0, f: 0 }, -1, [entry], waiting);
            joinAtEnd(waiting, 0, { s: 0, f: 0 }, -1, [entry]);
        } catch { /* an undecodable entry: no lines */ }
    }
    return { entry, lines, blocks };
}

/** The script at `entry` (a trigger's), merged and named for reading like the enter script. */
/** A trigger's script, merged; `entities`: what the room's enter script left in its cells (its MergedScript.entities). */
export function mergedRoomScript(bytes: Uint8Array, entry: number, entities: Record<number, string> = {}): MergedScript {
    return mergedScript(new ScriptRom(bytes), entry, readingNames(bytes), entities);
}

/** The names for reading (displayNames), with each text key's string from the ROM. */
function readingNames(bytes: Uint8Array): Names {
    return { ...displayNames(hiromFileOffset), text: (key) => dialogueText(bytes, key) ?? '' };
}

/** ROM room `mapId`'s enter script, merged; null when it has none. */
export function mergedEnterScript(bytes: Uint8Array, mapId: number): MergedScript | null {
    const rom = new ScriptRom(bytes);
    const entry = roomScripts(rom, mapId).enter;
    // For reading: names from the knowledge entries too, where the compiler's have none.
    return entry === null ? null : mergedScript(rom, entry, readingNames(bytes));
}

const hex6 = (v: number): string => v.toString(16).padStart(6, '0');
