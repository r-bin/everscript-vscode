// Ownership: a whole room, simulated — its enter script as scenarios, every
// trigger as cases, and the clusters that tie them together. Pure.
//
// A *scenario* is one way the enter script can go that does not fold back
// into another: an ending of its own (credits), or a branch that leaves the
// room or plays a scene (the outro). Branches that only add or skip an NPC
// stay inside a scenario as optional parts, each with its condition — that is
// what keeps "Fire Eyes' Village" at a handful of scenarios instead of 2^9.

import { Sym, key, under, isC } from './sym';
import { Pin } from './memory';
import { Machine } from './machine';
import { simulate, SimPath } from './explore';
import { SimEntity } from './state';
import { segment, splitPrepareExecute, stepsOfThread, threadsOf, Part } from './segments';
import { analyzeScript, ScriptAnalysis, Condition } from './trigger';
import { describeCondition, PINS_BETWEEN_PICKUPS } from './understand';

/** How much game time a room's enter script is followed for: 5 seconds. Reported, never hidden. */
export const ROOM_HORIZON = 300;

export interface Scenario {
    /** Conditions that select it, in the order the script tests them. */
    when: Condition[];
    /** Conditions merged paths disagreed on: they do not change this scenario. */
    either: string[];
    prepare: Part[];
    execute: Part[];
    entities: Array<SimEntity & { whenText: string }>;
    /**
     * Scripts the room starts that run alongside the enter script (0x07): when
     * each started and ended, in ticks, and what it did. Runs at the tick the
     * game runs it (explore.ts; checked against the game by scheduler.test.js).
     */
    background: Array<{ slot: number; started: string; ended: string | null; parts: Part[] }>;
    /** How many raw paths it stands for. */
    merged: number;
    end: string;
}

export interface FlagNode {
    cond?: Condition;
    then?: FlagNode;
    else?: FlagNode;
    /** Leaves: the scenarios this branch of the tree ends in. */
    scenarios?: number[];
}

export interface RoomTriggerAnalysis {
    type: 'step-on' | 'b-button';
    index: number;
    rect: { x1: number; y1: number; x2: number; y2: number };
    analysis: ScriptAnalysis;
}

export interface Cluster {
    kind: 'loot' | 'transition' | 'dialog' | 'cutscene' | 'script';
    title: string;
    triggers: Array<{ type: RoomTriggerAnalysis['type']; index: number }>;
    /** For loot: enter-script object parts that hide the pickups already taken. */
    preparedBy: Array<{ object: number; flag: string; at: number }>;
}

export interface RoomAnalysis {
    mapId: number;
    name: string;
    pins: readonly Pin[];
    enterEntry: number;
    scenarios: Scenario[];
    flags: FlagNode;
    triggers: RoomTriggerAnalysis[];
    clusters: Cluster[];
    capped: boolean;
}

export interface RoomTables {
    enter: { scriptAddressSnes: number };
    stepOn: Array<{ scriptAddressSnes: number; x1: number; y1: number; x2: number; y2: number }>;
    bTrigger: Array<{ scriptAddressSnes: number; x1: number; y1: number; x2: number; y2: number }>;
}

/** Major: one side leaves the room or plays a scene, so it is a different story, not a detail. */
function isMajor(p: Part): boolean {
    const scene = (x: Part): boolean => x.steps.some((s) => s.kind === 'event' && (s.event.type === 'text' || s.event.type === 'map'));
    const heavy = (ps: Part[]): boolean => ps.some((x) => x.kind === 'transition' || x.kind === 'dialog' ||
        (x.kind === 'call' && scene(x)) || (x.kind === 'if' && isMajor(x)));
    return p.kind === 'if' && (heavy(p.then ?? []) || heavy(p.else ?? []));
}

export function analyzeRoom(m: Machine, mapId: number, tables: RoomTables, pins: readonly Pin[] = PINS_BETWEEN_PICKUPS): RoomAnalysis {
    const sim = simulate(m, tables.enter.scriptAddressSnes, { pins, rejoin: true, maxPaths: 1024, maxSteps: 600000, maxTicks: ROOM_HORIZON, abstractVisual: true, keepCut: true });
    const scenarios: Scenario[] = [];
    const seen = new Map<string, Scenario>();
    for (const path of sim.paths) {
        if (path.end === 'recursion' || path.end === 'budget') continue;
        for (const v of expand(segment(stepsOfThread(path.steps, 0)), [])) {
            const s = scenario(m, path, v.parts, v.when);
            // Paths that differ only below what a scenario shows are one scenario.
            const sig = s.when.map((w) => w.text).join('&') + '|' + [...s.prepare, ...s.execute].map((p) => p.title).join(';') +
                '|' + s.entities.map((e) => e.label).join(',');
            const same = seen.get(sig);
            if (same) { same.merged += s.merged; continue; }
            seen.set(sig, s);
            scenarios.push(s);
        }
    }
    const triggers: RoomTriggerAnalysis[] = [
        ...tables.stepOn.map((t, index) => ({ type: 'step-on' as const, index, rect: rect(t), analysis: analyzeScript(m, t.scriptAddressSnes, pins) })),
        ...tables.bTrigger.map((t, index) => ({ type: 'b-button' as const, index, rect: rect(t), analysis: analyzeScript(m, t.scriptAddressSnes, pins) })),
    ];
    return {
        mapId, name: m.dec.mapName(mapId), pins, enterEntry: tables.enter.scriptAddressSnes,
        scenarios, flags: flagTree(scenarios.map((s, i) => ({ when: s.when, i }))),
        triggers, clusters: clusters(triggers, scenarios), capped: sim.capped,
    };

    function scenario(mm: Machine, path: SimPath, parts: Part[], extra: Condition[]): Scenario {
        const when = [...path.assumptions.filter((a) => a.depth === 0).map((a) => ({ cond: a.cond, value: a.value, text: describeCondition(a.cond, a.value, mm.dec) })), ...extra];
        const split = splitPrepareExecute(parts);
        // Thread 0 is the enter script; every other one was started while the room ran.
        const background = threadsOf(path.steps).filter((t) => t.tid !== 0)
            .map((t) => ({ slot: t.slot, started: t.started, ended: t.ended, parts: segment(stepsOfThread(path.steps, t.tid)) }));
        const known = new Map(when.map((w) => [key(w.cond), w.value] as [string, boolean]));
        const present = path.entities
            .map((e) => ({ ...e, when: under(e.when, known) }))
            .filter((e) => !(isC(e.when) && e.when.v === 0));
        return {
            when, either: path.either.map((e) => describeCondition(e, true, mm.dec)), ...split,
            entities: present.map((e) => ({ ...e, whenText: isC(e.when) ? 'always' : key(e.when) })),
            background,
            merged: path.merged, end: path.end,
        };
    }

    /** One variant per side of every major branch, with that branch's condition added. */
    function expand(parts: Part[], when: Condition[]): Array<{ parts: Part[]; when: Condition[] }> {
        const i = parts.findIndex(isMajor);
        if (i < 0) return [{ parts, when }];
        const b = parts[i];
        const side = (v: boolean): Condition => ({ cond: b.cond!, value: v, text: describeCondition(b.cond!, v, m.dec) });
        return [
            ...expand([...parts.slice(0, i), ...(b.then ?? []), ...parts.slice(i + 1)], [...when, side(true)]),
            ...expand([...parts.slice(0, i), ...(b.else ?? []), ...parts.slice(i + 1)], [...when, side(false)]),
        ];
    }
}

/** The binary tree of the conditions that tell scenarios apart. */
export function flagTree(items: Array<{ when: Condition[]; i: number }>, depth = 0): FlagNode {
    // Scenarios that do not test a condition sit on both sides of it, so the tree can
    // grow fast: past a depth, the rest is listed rather than split further.
    if (items.length <= 1 || depth >= 10) return { scenarios: items.map((x) => x.i) };
    const ck = (c: Condition): string => key(c.cond);
    // Split on the first condition that some scenarios assume true and others false.
    for (const c of items[0].when.concat(...items.map((x) => x.when))) {
        const yes = items.filter((x) => x.when.some((w) => ck(w) === ck(c) && w.value));
        const no = items.filter((x) => x.when.some((w) => ck(w) === ck(c) && !w.value));
        if (!yes.length || !no.length) continue;
        const rest = items.filter((x) => !yes.includes(x) && !no.includes(x));
        const strip = (xs: typeof items) => xs.map((x) => ({ i: x.i, when: x.when.filter((w) => ck(w) !== ck(c)) }));
        return { cond: { ...c, value: true, text: c.value ? c.text : c.text.replace(/^not /, '') }, then: flagTree(strip([...yes, ...rest]), depth + 1), else: flagTree(strip([...no, ...rest]), depth + 1) };
    }
    return { scenarios: items.map((x) => x.i) };
}

function clusters(triggers: RoomTriggerAnalysis[], scenarios: Scenario[]): Cluster[] {
    const out: Cluster[] = [];
    const by = (k: Cluster['kind']): RoomTriggerAnalysis[] => triggers.filter((t) => t.analysis.kind === k);
    const ref = (t: RoomTriggerAnalysis) => ({ type: t.type, index: t.index });
    const loot = by('loot');
    if (loot.length) {
        // A pickup's object is prepared by the enter script when it hides that object under the pickup's own flag.
        const flags = new Map<string, number>();
        for (const t of loot) for (const c of t.analysis.cases) for (const f of c.loot?.flagsSet ?? []) flags.set(`${f.addr}:${f.bit}`, c.loot!.object ?? -1);
        const preparedBy: Cluster['preparedBy'] = [];
        const objectParts = (ps: Part[]): Part[] => ps.flatMap((x) => x.kind === 'objects' ? [x] : x.kind === 'if' ? [...objectParts(x.then ?? []), ...objectParts(x.else ?? [])] : []);
        for (const p of scenarios.flatMap((s) => objectParts(s.prepare))) {
            for (const s of p.steps) {
                if (s.kind !== 'event' || s.event.type !== 'object') continue;
                const w = s.event.when;
                if (w.k === 'bit' && w.a.k === 'mem' && flags.has(`${w.a.addr}:${w.bit}`) && s.event.index.k === 'c' &&
                    !preparedBy.some((x) => x.at === s.event.at)) {
                    preparedBy.push({ object: s.event.index.v, flag: key(w), at: s.event.at });
                }
            }
        }
        out.push({ kind: 'loot', title: `${loot.length} pickups`, triggers: loot.map(ref), preparedBy });
    }
    const doors = by('transition');
    if (doors.length) out.push({ kind: 'transition', title: `${doors.length} exits`, triggers: doors.map(ref), preparedBy: [] });
    for (const k of ['dialog', 'cutscene', 'script'] as const) {
        const ts = by(k);
        if (ts.length) out.push({ kind: k, title: `${ts.length} ${k} trigger${ts.length > 1 ? 's' : ''}`, triggers: ts.map(ref), preparedBy: [] });
    }
    return out;
}

function rect(t: { x1: number; y1: number; x2: number; y2: number }) {
    return { x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2 };
}

export type { Sym };
