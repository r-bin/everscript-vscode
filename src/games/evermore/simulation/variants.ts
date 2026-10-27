// Ownership: a room as the *variants* a player can meet — who stands in it,
// under which story state, and a name for it. Pure.
//
// room.ts tells the enter script as scenarios: one per way the script can go.
// A map wants both less and more than that. Less, because scenarios that place
// the same characters look the same on the map. More, because a character a
// scenario places only under a condition (a boss still alive) makes a
// different room. So every scenario is split on the conditions its characters
// carry, and the pieces are folded by what stands in the room.
//
// Which conditions split is the caller's call (`splitOn`): the Rooms tab splits
// on enemies only, so a village's townsfolk — each behind a flag of its own —
// stay one room with "only if …" on them instead of 2^n rooms.
//
// A condition the scripts *poll* — the same test reached again on one path, a
// loop waiting for it — is something that changes while the player is in the
// room, never the state they enter it in. Thraxx's chamber refills its maggots
// every 60 ticks once "maggots triggered" is set mid-fight; that is the fight
// going on, not a fourth room. Polled conditions never split, and a character
// placed only under one is `later` on the variant: shown, but not what tells
// variants apart.
//
// Names come from the ROM: the story flags that select a variant (their
// labels), then the characters only it places. Nothing else is guessed. The
// short `title` is what a list shows: the one or two characters only it
// places ("Thraxx", "Coleoptera"), "Empty" when nobody stands there, else
// the flags.
//
// `reached` is every instruction the variant can run: what a script viewer
// shows live for it, the rest greyed. A static walk of the enter script and
// what it calls and starts (a visited set: loops cannot hold it up), taking at
// each branch the condition the run recorded there (`RoomAnalysis.branches`)
// under each of the variant's flag assignments. A branch the run never tested,
// or tested differently each time round a loop, keeps both sides.

import { Sym, key, isC, truthy } from './sym';
import { Decoder, Machine } from './machine';
import { Condition } from './trigger';
import { RoomAnalysis, Scenario } from './room';
import { Part } from './segments';
import { describeCondition } from './understand';

/** A scenario is split on at most this many conditions (2^n pieces); past it, conditional characters count as present. */
const MAX_SPLIT = 6;

export interface VariantSpawn {
    /** The instruction that places it: the same `at` as the decoded spawn (script-model SpawnFacts). */
    at: number;
    /** The character's name, without the address suffix. */
    name: string;
    npc: number;
    x: number | null;
    y: number | null;
    /** How many times this one instruction placed it (a spawner in a loop). */
    count: number;
    /** Set when it stands here only under a condition the variant did not split on. */
    when?: string;
    /** Placed only once something happens in the room (a polled condition): not part of who the variant is. */
    later?: boolean;
}

export interface RoomVariant {
    /** The selecting flags (or "default"), then what only it places. */
    name: string;
    /** What a list shows: who only it places ("Thraxx"), "Empty", or the flags. */
    title: string;
    /** Labelled story flags that hold in it, e.g. "In credits". Empty for the default. */
    flags: string[];
    /** Character names only this variant has, e.g. "Thraxx's heart". */
    only: string[];
    /** Names of the other stories folded into it because they place the same characters. */
    also: string[];
    /** What selects it, in words: one line per folded scenario piece. */
    when: string[];
    spawns: VariantSpawn[];
    /** Indices into `RoomAnalysis.scenarios`. */
    scenarios: number[];
    /** Every instruction its scenarios ran, in any thread, sorted. */
    reached: number[];
    /** A budget stopped a path it came from: who was placed is known, what came after may not be. */
    cut: boolean;
}

interface Piece { scenario: number; when: Condition[]; flags: string[]; spawns: VariantSpawn[]; cut: boolean; assignments: Array<Map<string, boolean>> }

/** Which placements make a different room when their condition changes; by default, all. */
export type SplitOn = (spawn: { at: number; npc: number }) => boolean;

export function roomVariants(room: RoomAnalysis, dec: Decoder, splitOn: SplitOn = () => true, m?: Machine): RoomVariant[] {
    const walks = new Map<string, Set<number>>();
    const pieces = room.scenarios.flatMap((s, i) => split(s, i, dec, splitOn));
    // Fold by who stands in the room on entry; the first flagless piece names the fold.
    const byCast = new Map<string, Piece[]>();
    for (const p of pieces) {
        const k = p.spawns.filter((x) => !x.later).map((x) => x.at).join(',');
        byCast.set(k, [...(byCast.get(k) ?? []), p]);
    }
    const folds = [...byCast.values()].map((ps) => {
        const named = ps.filter((p) => p.flags.length);
        const first = ps.find((p) => !p.flags.length) ?? named[0];
        // What happens later in the variant's own story (its flags) happens in it; the stories folded
        // in because they start with the same characters keep theirs.
        const spawns = [...first.spawns];
        const story = first.flags.join(' · ');
        for (const p of ps) {
            if (p.flags.join(' · ') !== story) continue;
            for (const x of p.spawns) if (x.later && !spawns.some((y) => y.at === x.at)) spawns.push(x);
        }
        const lead = { ...first, spawns: spawns.sort((a, b) => a.at - b.at) };
        const others = [...new Set(named.filter((p) => p !== first).map((p) => p.flags.join(' · ')))]
            .filter((n) => n !== lead.flags.join(' · '));
        return {
            lead, also: others,
            when: [...new Set(ps.map((p) => p.when.map((w) => w.text).join(' & ') || 'always'))],
            scenarios: [...new Set(ps.map((p) => p.scenario))],
            cut: ps.some((p) => p.cut),
            reached: m ? reachedBy(m, room, ps, walks) : [],
        };
    });
    const names = folds.map((f) => new Set(f.lead.spawns.filter((s) => !s.later).map((s) => s.name)));
    const variants = folds.map((f, i): RoomVariant => {
        const mine = [...names[i]];
        const unique = mine.filter((n) => names.every((o, j) => j === i || !o.has(n)));
        const only = unique.length ? unique : mine.filter((n) => !names.every((o) => o.has(n)));
        const head = f.lead.flags.length ? f.lead.flags.join(' · ') : 'default';
        return {
            name: only.length ? `${head} — ${only.slice(0, 3).join(', ')}${only.length > 3 ? ', …' : ''}` : head,
            title: title(f.lead.spawns, only, head),
            flags: f.lead.flags, only, also: f.also, when: f.when,
            spawns: f.lead.spawns, scenarios: f.scenarios, reached: f.reached, cut: f.cut,
        };
    });
    // Default first, then the busiest rooms.
    return variants.sort((a, b) => (a.flags.length ? 1 : 0) - (b.flags.length ? 1 : 0) || b.spawns.length - a.spawns.length);
}

/**
 * The short name: the one or two characters only this variant places, a boss by its own name
 * ("Thraxx's heart" is Thraxx); "Empty" when nobody stands there on entry; else the flags.
 * Placeholder characters name nothing.
 */
function title(spawns: VariantSpawn[], only: string[], head: string): string {
    if (!spawns.some((s) => !s.later)) return 'Empty';
    const who = [...new Set(only.filter((n) => !/^(PLACEHOLDER|UNKNOWN)/.test(n)).map((n) => n.replace(/'s heart$/, '')))];
    return who.length && who.length <= 2 ? who.join(', ') : head;
}

/** One scenario, cut into pieces by the conditions its `splitOn` characters carry. */
function split(s: Scenario, index: number, dec: Decoder, splitOn: SplitOn): Piece[] {
    const polls = polled(s);
    const atoms = new Map<string, Sym>();
    for (const e of firsts(s.entities)) if (splitOn(e)) conditionsIn(e.when, atoms);
    for (const k of polls) atoms.delete(k);
    const list = atoms.size <= MAX_SPLIT ? [...atoms.values()] : [];
    const groups = new Map<string, { spawns: VariantSpawn[]; seen: Array<Map<string, boolean>> }>();
    for (let bits = 0; bits < 1 << list.length; bits++) {
        const known = new Map(list.map((a, i) => [key(a), !!(bits & (1 << i))] as [string, boolean]));
        const spawns = cast(s.entities, known, dec, polls);
        const k = spawns.map((x) => x.at).join(',');
        const g = groups.get(k) ?? { spawns, seen: [] };
        g.seen.push(known);
        groups.set(k, g);
    }
    const cut = s.end === 'cut';
    return [...groups.values()].map((g) => {
        // What all of a piece's assignments agree on is what selects it.
        const agreed: Condition[] = list.filter((a) => g.seen.every((m) => m.get(key(a)) === g.seen[0].get(key(a))))
            .map((a) => { const value = g.seen[0].get(key(a))!; return { cond: a, value, text: describeCondition(a, value, dec) }; });
        const when = groups.size > 1 ? [...s.when, ...agreed] : s.when;
        const base = new Map<string, boolean>();
        for (const w of s.when) learn(base, w.cond, w.value);
        const assignments = g.seen.map((seen) => { const k = new Map(base); for (const [a, v] of seen) k.set(a, v); return k; });
        return { scenario: index, when, flags: storyFlags(when, dec), spawns: g.spawns, cut, assignments };
    });
}

/** Every instruction the pieces can run, under any of their assignments, sorted. `walks` keeps walks by assignment. */
function reachedBy(m: Machine, room: RoomAnalysis, ps: Piece[], walks: Map<string, Set<number>>): number[] {
    const out = new Set<number>();
    for (const p of ps) {
        for (const known of p.assignments) {
            const k = [...known].map(([a, v]) => (v ? '' : '!') + a).sort().join('&');
            let w = walks.get(k);
            if (!w) { w = walk(m, room, known); walks.set(k, w); }
            for (const pc of w) out.add(pc);
        }
    }
    return [...out].sort((a, b) => a - b);
}

/** Jumps that only go to their target (0x04 goto, 0x05 goto_back); other branch effects may fall through. */
const JUMPS = new Set([0x04, 0x05]);
/** Branch on a condition: 0x08 jumps when it holds, 0x09 when it does not. */
const JUMP_IF_TRUE = 0x08, JUMP_IF_FALSE = 0x09;

/** The enter script's instructions reachable under `known`, following calls, starts and global calls. */
function walk(m: Machine, room: RoomAnalysis, known: ReadonlyMap<string, boolean>): Set<number> {
    const seen = new Set<number>();
    const todo = [room.enterEntry];
    while (todo.length) {
        const at = todo.pop()!;
        if (seen.has(at)) continue;
        const ins = m.instruction(at);
        if (!ins) continue;
        seen.add(at);
        const next = at + ins.size;
        let target: number | null = null;
        for (const e of ins.effects) {
            if (e.kind === 'branch') target = e.target;
            else if (e.kind === 'call') todo.push(e.target);
            else if (e.kind === 'callGlobal') todo.push(m.globalScript(e.id));
        }
        if (ins.terminal) continue;
        if (target === null) { todo.push(next); continue; }
        if (JUMPS.has(ins.opcode)) { todo.push(target); continue; }
        const cond = room.branches.get(at);
        const t = cond && (ins.opcode === JUMP_IF_TRUE || ins.opcode === JUMP_IF_FALSE) ? truth(cond, known) : null;
        if (t === null) todo.push(next, target);
        else todo.push(t === (ins.opcode === JUMP_IF_TRUE) ? target : next);
    }
    return seen;
}

/** Record that `cond` is `value`, and what that settles about its parts (`a && b` true: both true). */
function learn(known: Map<string, boolean>, cond: Sym, value: boolean): void {
    known.set(key(cond), value);
    known.set(key(truthy(cond)), value);
    if (isC(cond)) return;
    if (cond.k === 'un' && cond.op === '!') { learn(known, cond.a, !value); return; }
    if (cond.k === 'bin' && ((cond.op === '&&' && value) || (cond.op === '||' && !value))) { learn(known, cond.a, value); learn(known, cond.b, value); }
}

/** The characters that can stand here under `known`, one per placing instruction, in script order. */
function cast(entities: Scenario['entities'], known: ReadonlyMap<string, boolean>, dec: Decoder, polls: ReadonlySet<string>): VariantSpawn[] {
    const by = new Map<number, VariantSpawn>();
    const decided = new Set<number>();
    for (const e of entities) {
        const had = by.get(e.at);
        if (had) { had.count++; continue; }
        // Only an instruction's first placement says whether it stands here.
        if (decided.has(e.at)) continue;
        decided.add(e.at);
        const t = truth(e.when, known);
        if (t === false) continue;
        const spawn: VariantSpawn = { at: e.at, name: e.label.replace(/#[0-9a-f]+(\.\d+)?$/, ''), npc: e.npc, x: e.x, y: e.y, count: 1 };
        if (t === null) {
            spawn.when = conditionText(e.when, dec);
            const leaves = new Map<string, Sym>();
            conditionsIn(e.when, leaves);
            if ([...leaves.keys()].some((k) => polls.has(k))) spawn.later = true;
        }
        by.set(e.at, spawn);
    }
    return [...by.values()].sort((a, b) => a.at - b.at);
}

/**
 * The leaf conditions the scenario's scripts poll: those of a test (an `if`)
 * that one path reaches at the same instruction more than once, in the enter
 * script or a script it started.
 */
function polled(s: Scenario): Set<string> {
    const count = new Map<number, Part[]>();
    const walk = (parts: Part[]): void => {
        for (const p of parts) {
            if (p.kind === 'if' && p.cond) count.set(p.at, [...(count.get(p.at) ?? []), p]);
            walk(p.then ?? []);
            walk(p.else ?? []);
        }
    };
    walk([...s.prepare, ...s.execute]);
    for (const b of s.background) walk(b.parts);
    const out = new Map<string, Sym>();
    for (const ps of count.values()) if (ps.length > 1) for (const p of ps) conditionsIn(p.cond!, out);
    return new Set(out.keys());
}

/**
 * Each instruction's first placement. A spawner in a loop places again and
 * again under ever longer conditions (its own earlier placements); those say
 * how many, not whether.
 */
function firsts(entities: Scenario['entities']): Scenario['entities'] {
    const seen = new Set<number>();
    return entities.filter((e) => !seen.has(e.at) && (seen.add(e.at), true));
}

/**
 * A condition's value under `known`, or null when it still depends on
 * something else. Three-valued, so `x && 0` is false whatever x is — which
 * `under` (sym.ts) leaves as written.
 */
function truth(s: Sym, known: ReadonlyMap<string, boolean>): boolean | null {
    if (isC(s)) return s.v !== 0;
    const k = known.get(key(s));
    if (k !== undefined) return k;
    if (s.k === 'un' && s.op === '!') { const a = truth(s.a, known); return a === null ? null : !a; }
    if (s.k === 'bin' && (s.op === '&&' || s.op === '||')) {
        const a = truth(s.a, known), b = truth(s.b, known);
        const and = s.op === '&&';
        if (a === !and || b === !and) return !and;
        return a === null || b === null ? null : and;
    }
    if (s.k === 'ite') {
        const c = truth(s.cond, known);
        if (c !== null) return truth(c ? s.a : s.b, known);
        const a = truth(s.a, known), b = truth(s.b, known);
        return a === b ? a : null;
    }
    return null;
}

/** A condition in words, with flag labels where the flags have them. */
function conditionText(s: Sym, dec: Decoder): string {
    const leaves = new Map<string, Sym>();
    conditionsIn(s, leaves);
    let text = key(s);
    for (const [k, a] of leaves) {
        if (a.k !== 'bit' || a.a.k !== 'mem') continue;
        const name = dec.flagName(a.a.addr, a.bit);
        if (name) text = text.split(k).join(`${k} (${name})`);
    }
    return text;
}

/** The leaf conditions under `&&`, `||`, `!` and merged values. */
function conditionsIn(s: Sym, out: Map<string, Sym>): void {
    if (isC(s)) return;
    if (s.k === 'un' && s.op === '!') return conditionsIn(s.a, out);
    if (s.k === 'bin' && (s.op === '&&' || s.op === '||')) { conditionsIn(s.a, out); conditionsIn(s.b, out); return; }
    if (s.k === 'ite') { conditionsIn(s.cond, out); conditionsIn(s.a, out); conditionsIn(s.b, out); return; }
    out.set(key(s), s);
}

/**
 * The labelled flags a story holds under: the flags its conditions require
 * set, by name. A condition taken as true that requires none (an `ite`, an
 * `||`) names the labelled flags it tests as set instead — which is how
 * "($22eb&0x08 ? … : $22f1&0x40)" still reads as "Inside outro?". A condition
 * taken as false never names one: "not (A && !B)" holds with A clear alone.
 */
function storyFlags(when: Condition[], dec: Decoder): string[] {
    const out: string[] = [];
    const named = (leaves: Sym[]): string[] => leaves.flatMap((a) => {
        const name = a.k === 'bit' && a.a.k === 'mem' ? dec.flagName(a.a.addr, a.bit) : '';
        return name ? [name] : [];
    });
    for (const w of when) {
        const req: Sym[] = [];
        required(w.cond, w.value, req);
        let names = named(req);
        if (!names.length && w.value) { const m: Sym[] = []; mentioned(w.cond, true, m); names = named(m); }
        for (const n of names) if (!out.includes(n)) out.push(n);
    }
    return out;
}

/** Leaves that must be set for `s` to be `value`. */
function required(s: Sym, value: boolean, out: Sym[]): void {
    if (isC(s)) return;
    if (s.k === 'un' && s.op === '!') return required(s.a, !value, out);
    // a && b true, or a || b false: both sides are decided. The other two decide neither.
    if (s.k === 'bin' && ((s.op === '&&' && value) || (s.op === '||' && !value))) { required(s.a, value, out); required(s.b, value, out); return; }
    if (s.k === 'bin' && (s.op === '&&' || s.op === '||')) return;
    if (s.k === 'ite') return;
    if (value) out.push(s);
}

/** Leaves tested as set anywhere in `s` (an ite's own condition goes either way). */
function mentioned(s: Sym, set: boolean, out: Sym[]): void {
    if (isC(s)) return;
    if (s.k === 'un' && s.op === '!') return mentioned(s.a, !set, out);
    if (s.k === 'bin' && (s.op === '&&' || s.op === '||')) { mentioned(s.a, set, out); mentioned(s.b, set, out); return; }
    if (s.k === 'ite') { mentioned(s.a, set, out); mentioned(s.b, set, out); return; }
    if (set) out.push(s);
}

/** The variants as Markdown: one section per variant, its conditions and who stands where. */
export function variantsReport(room: Pick<RoomAnalysis, 'mapId' | 'name' | 'capped'>, variants: RoomVariant[]): string {
    const hex = (v: number, d: number): string => v.toString(16).padStart(d, '0');
    const out = [`# Room 0x${hex(room.mapId, 2)} — ${room.name}: variants`, '',
        'Who stands in the room, per story state: the enter script\'s scenarios, split on the conditions its',
        'enemies carry and folded by who is placed. Named from the flags\' labels, then the characters only one variant has.',
        ...(room.capped ? ['', '> The analysis hit its budget; paths still running then are kept (marked *cut*): who they placed is known.'] : []), ''];
    for (const v of variants) {
        out.push(`## ${v.title}${v.cut ? ' *(cut)*' : ''}`, '', v.title !== v.name ? `${v.name}.` : '', '');
        if (v.also.length) out.push(`Same characters as: ${v.also.join('; ')}.`, '');
        out.push('When:', ...v.when.map((w) => `- ${w}`), '');
        if (!v.spawns.length) { out.push('Nobody is placed.', ''); continue; }
        out.push('| at | character | x | y | only if |', '|---|---|---|---|---|',
            ...v.spawns.map((s) => `| $${hex(s.at, 6)} | ${s.name}${s.count > 1 ? ` ×${s.count}` : ''} | ${s.x ?? '—'} | ${s.y ?? '—'} | ${s.when ? (s.later ? 'later, ' : '') + '`' + s.when + '`' : ''} |`), '');
    }
    return out.join('\n');
}
