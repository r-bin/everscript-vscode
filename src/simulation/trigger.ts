// Ownership: what one trigger (step-on, B-button) or other small script does,
// told as cases: "Call Beads when Thraxx is dead, Biscuit otherwise". Pure.
//
// Every path is simulated separately (no rejoining), so each outcome keeps
// the exact conditions that lead to it. A case's conditions are what its
// paths agree on *and* what tells it apart from the other cases — the
// conditions every successful pickup shares (not yet taken, the boy is in
// control, room in the bag) are reported once, as `always`.

import { Sym, key } from './sym';
import { Pin } from './memory';
import { Machine } from './machine';
import { simulate, SimPath } from './explore';
import { lootOutcome, LootOutcome, describeCondition, PINS_BETWEEN_PICKUPS } from './understand';
import { segment, Part } from './segments';

export type TriggerKind = 'loot' | 'transition' | 'dialog' | 'cutscene' | 'script';

export interface Condition { cond: Sym; value: boolean; text: string }

export interface Case {
    /** "1 × CALL_BEADS", "change map to 0x41", ... */
    label: string;
    /** What has to hold, beyond `always`. */
    when: Condition[];
    loot: LootOutcome | null;
    mapId: number | null;
    paths: number;
}

export interface ScriptAnalysis {
    entry: number;
    kind: TriggerKind;
    cases: Case[];
    /** Conditions every case of the main kind needs. */
    always: Condition[];
    /** Paths where nothing of the main kind happened: already taken, the dog pressed B, bag full, ... */
    otherwise: Array<{ when: Condition[]; either: string[]; note: string }>;
    /** The first path's trace, grouped — the trigger's shape. */
    parts: Part[];
    paths: SimPath[];
    capped: boolean;
    /** How finely it could afford to look: separate paths, or merged where branches rejoin. */
    detail: 'every path' | 'helpers merged' | 'all branches merged';
    pins: readonly Pin[];
}

export function analyzeScript(m: Machine, entry: number, pins: readonly Pin[] = PINS_BETWEEN_PICKUPS): ScriptAnalysis {
    // Every outcome apart if that is affordable; else let helpers merge; else merge everything.
    let res = simulate(m, entry, { pins, maxPaths: 96, maxSteps: 40000 });
    let detail: ScriptAnalysis['detail'] = 'every path';
    if (res.capped) { res = simulate(m, entry, { pins, rejoin: true, joinDepth: 1, maxPaths: 96, maxSteps: 40000 }); detail = 'helpers merged'; }
    if (res.capped) { res = simulate(m, entry, { pins, rejoin: true, maxPaths: 96, maxSteps: 60000 }); detail = 'all branches merged'; }
    const paths = res.paths;
    const loots = paths.map((p) => lootOutcome(p, m.dec));
    const maps = paths.map((p) => firstMap(p));
    const kind: TriggerKind = loots.some((l) => l) ? 'loot'
        : maps.some((x) => x !== null) ? 'transition'
            : paths.some((p) => hasEvent(p, 'text')) ? 'dialog'
                : paths.some((p) => hasEvent(p, 'spawn')) ? 'cutscene' : 'script';

    const hit = (i: number): string | null => {
        if (kind === 'loot') { const l = loots[i]; return l && l.looted ? `${amountText(l.amount)} × ${l.itemName}` : null; }
        if (kind === 'transition') return maps[i] !== null ? `change map to 0x${maps[i]!.toString(16).padStart(2, '0')}` : null;
        return 'runs';
    };
    const conds = (p: SimPath): Condition[] => p.assumptions.map((a) => ({ cond: a.cond, value: a.value, text: describeCondition(a.cond, a.value, m.dec) }));
    const ckey = (c: Condition): string => `${c.value ? '' : '!'}${key(c.cond)}`;

    const groups = new Map<string, number[]>();
    paths.forEach((_, i) => { const h = hit(i); if (h) groups.set(h, [...(groups.get(h) ?? []), i]); });
    const all = [...groups.values()].flat();
    const common = intersect(all.map((i) => conds(paths[i])), ckey);
    const cases: Case[] = [...groups.entries()].map(([label, idx]) => ({
        label,
        when: intersect(idx.map((i) => conds(paths[i])), ckey).filter((c) => !common.some((x) => ckey(x) === ckey(c))),
        loot: loots[idx[0]],
        mapId: maps[idx[0]],
        paths: idx.length,
    }));
    const otherwise = paths.map((p, i) => ({ p, i })).filter(({ i }) => !hit(i)).map(({ p, i }) => ({
        when: conds(p),
        either: p.either.map((e) => key(e) === '(boy == controlled char)' ? 'who is in control' : describeCondition(e, true, m.dec)),
        note: kind === 'loot' ? (loots[i] ? `nothing looted (${loots[i]!.itemName} staged)` : 'nothing staged')
            : segment(p.steps).map((x) => x.title).slice(0, 3).join(', ') || 'nothing',
    }));
    return { entry, kind, cases, always: common, otherwise, parts: paths.length ? segment(paths[0].steps) : [], paths, capped: res.capped, detail, pins };
}

function amountText(a: Sym | null): string {
    return a ? key(a) : '?';
}

function firstMap(p: SimPath): number | null {
    for (const s of p.steps) if (s.kind === 'event' && s.event.type === 'map') return s.event.mapId;
    return null;
}

function hasEvent(p: SimPath, type: string): boolean {
    return p.steps.some((s) => s.kind === 'event' && s.event.type === type && s.event.depth === 0);
}

function intersect<T>(lists: T[][], k: (x: T) => string): T[] {
    if (!lists.length) return [];
    return lists[0].filter((x) => lists.every((l) => l.some((y) => k(y) === k(x))));
}
