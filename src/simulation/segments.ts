// Ownership: grouping a simulated trace into the pieces a reader thinks in —
// "places Fire Eyes", "hides the sniff spots already taken", "leaves for
// room 0x41" — and splitting a room's enter script into preparing the room
// and running it. Pure.
//
// A part is built from the *trace*, so its values are the simulated ones: a
// placed NPC carries the RAM word its handle went to, an object part carries
// the flag that hides it. Nothing is matched on raw bytes.

import { Sym, key, isC } from './sym';
import { Step, SimEvent } from './state';

export type PartKind =
    | 'npc' | 'objects' | 'transition' | 'dialog' | 'music' | 'flags' | 'loot'
    | 'call' | 'wait' | 'script' | 'if';

export interface Part {
    kind: PartKind;
    /** One line, in our words. */
    title: string;
    /** The first instruction of the part. */
    at: number;
    /** Top-level steps the part covers (calls carry their inner steps). */
    steps: Step[];
    /** For `if`: the condition and both sides, themselves grouped. */
    cond?: Sym;
    then?: Part[];
    else?: Part[];
}

/** Global loot drivers (see understand.ts). */
const LOOT_DRIVER_IDS = new Set([0x39, 0x3a, 0x3b]);

const hx = (v: number, d = 2): string => '0x' + v.toString(16).padStart(d, '0');

/** Global scripts that mark the screen becoming visible (see the README). */
const FADE_IN = [/^Fade-in/, /^Unnamed Global script 0x36$/, /cinematic/i];

/** The steps of one thread (by its uid), branches included. */
export function stepsOfThread(steps: readonly Step[], tid: number): Step[] {
    const out: Step[] = [];
    for (const st of steps) {
        if (st.kind === 'event') { if (st.event.tid === tid) out.push(st); continue; }
        if (st.kind === 'branch') {
            const then = stepsOfThread(st.then, tid), other = stepsOfThread(st.else, tid);
            if (then.length || other.length) out.push({ ...st, then, else: other });
            continue;
        }
        out.push(st);
    }
    return out;
}

/** Every thread a trace shows, in order of first appearance: slot, first and last tick, how it ended. */
export function threadsOf(steps: readonly Step[]): Array<{ tid: number; slot: number; started: string; ended: string | null; events: number }> {
    const seen = new Map<number, { tid: number; slot: number; started: string; ended: string | null; events: number }>();
    const walk = (ss: readonly Step[]): void => {
        for (const st of ss) {
            if (st.kind === 'branch') { walk(st.then); walk(st.else); continue; }
            if (st.kind !== 'event') continue;
            const e = st.event;
            let t = seen.get(e.tid);
            if (!t) { t = { tid: e.tid, slot: e.thread, started: e.time, ended: null, events: 0 }; seen.set(e.tid, t); }
            t.events++;
            if (e.type === 'thread-end') t.ended = e.time;
        }
    };
    walk(steps);
    return [...seen.values()];
}

/** Group a step list (top level of a trace, or one side of a branch). */
export function segment(steps: Step[]): Part[] {
    const parts: Part[] = [];
    let i = 0;
    while (i < steps.length) {
        const st = steps[i];
        if (st.kind === 'branch') {
            const then = segment(st.then), other = segment(st.else);
            // A branch whose sides did nothing visible differently is not worth a line.
            if (then.length || other.length) parts.push({ kind: 'if', title: `if ${key(st.cond)}`, at: st.at, steps: [st], cond: st.cond, then, else: other });
            i++;
            continue;
        }
        if (st.kind === 'decide') {
            // Not a part: an undecided one is a condition of the whole scenario,
            // a decided one is just the script testing what it already knows.
            i++;
            continue;
        }
        const ev = st.event;
        if (ev.depth > 0) { i++; continue; }
        const start = i;
        const inner = (): void => { i++; while (i < steps.length && depthOf(steps[i]) > 0) i++; };
        switch (ev.type) {
            case 'spawn': {
                const label = ev.label;
                inner();
                // What the script does to the new NPC right away: store its handle, set scripts, face it.
                while (i < steps.length && touches(steps[i], label)) inner();
                parts.push({ kind: 'npc', title: `place ${label}`, at: ev.at, steps: steps.slice(start, i) });
                continue;
            }
            case 'object': {
                while (i < steps.length && isEvent(steps[i], 'object')) i++;
                const n = i - start;
                parts.push({ kind: 'objects', title: `${n} object state${n > 1 ? 's' : ''}`, at: ev.at, steps: steps.slice(start, i) });
                continue;
            }
            case 'map':
                inner();
                parts.push({ kind: 'transition', title: `change map to ${hx(ev.mapId)} at (${ev.x}, ${ev.y})`, at: ev.at, steps: steps.slice(start, i) });
                continue;
            case 'music':
                inner();
                parts.push({ kind: 'music', title: `play music ${hx(ev.track)}`, at: ev.at, steps: steps.slice(start, i) });
                continue;
            case 'text': {
                inner();
                while (i < steps.length && (isEvent(steps[i], 'text') || isDialogGlue(steps[i]))) inner();
                parts.push({ kind: 'dialog', title: `dialog (${steps.slice(start, i).filter((s) => isEvent(s, 'text')).length} text)`, at: ev.at, steps: steps.slice(start, i) });
                continue;
            }
            case 'flag': case 'write': {
                while (i < steps.length && (isEvent(steps[i], 'flag') || isEvent(steps[i], 'write')) && depthOf(steps[i]) === 0) i++;
                parts.push({ kind: 'flags', title: `${i - start} RAM write${i - start > 1 ? 's' : ''}`, at: ev.at, steps: steps.slice(start, i) });
                continue;
            }
            case 'call': {
                inner();
                const loot = ev.global !== null && LOOT_DRIVER_IDS.has(ev.global);
                parts.push({ kind: loot ? 'loot' : 'call', title: `${ev.async ? 'start' : 'call'} ${ev.name}`, at: ev.at, steps: steps.slice(start, i) });
                continue;
            }
            case 'wait': case 'wake':
                inner();
                parts.push({ kind: 'wait', title: ev.summary, at: ev.at, steps: steps.slice(start, i) });
                continue;
            default:
                inner();
                parts.push({ kind: 'script', title: ev.summary, at: ev.at, steps: steps.slice(start, i) });
        }
    }
    return mergeTransitions(parts);
}

/**
 * "Prepare room change" global + whatever it writes + the map change are
 * one thing to a reader: a door. Fold them into the transition part.
 */
function mergeTransitions(parts: Part[]): Part[] {
    const out: Part[] = [];
    for (const p of parts) {
        if (p.kind === 'transition') {
            let k = out.length;
            while (k > 0 && ['flags', 'wait', 'call', 'script'].includes(out[k - 1].kind) && !/^call .*Loot/.test(out[k - 1].title)) {
                k--;
                if (/Prepare room change|Fade-out/.test(out[k].title)) break;
            }
            const lead = out.splice(k);
            if (lead.some((x) => /Prepare room change|Fade-out/.test(x.title))) {
                out.push({ ...p, at: lead[0].at, steps: [...lead.flatMap((x) => x.steps), ...p.steps] });
                continue;
            }
            out.push(...lead);
        }
        out.push(p);
    }
    return out;
}

/**
 * Where a room stops being prepared and starts running: the first top-level
 * part that fades the screen in (a fade-in global, or a call that reaches
 * one). Everything before it happens behind a black screen.
 */
export function splitPrepareExecute(parts: Part[]): { prepare: Part[]; execute: Part[] } {
    const idx = parts.findIndex((p) => p.kind !== 'if' && p.steps.some((s) =>
        s.kind === 'event' && s.event.type === 'call' && FADE_IN.some((r) => r.test((s.event as { name: string }).name))));
    if (idx < 0) return { prepare: parts, execute: [] };
    return { prepare: parts.slice(0, idx), execute: parts.slice(idx) };
}

function depthOf(s: Step): number { return s.kind === 'event' ? s.event.depth : s.depth; }
function isEvent(s: Step, type: SimEvent['type']): boolean { return s.kind === 'event' && s.event.type === type; }
function isDialogGlue(s: Step): boolean {
    return s.kind === 'event' && s.event.depth === 0 && /TEXT|messagebox|message timer/i.test(s.event.summary) && s.event.type !== 'call';
}
function touches(s: Step, label: string): boolean {
    if (s.kind !== 'event' || s.event.depth > 0) return false;
    if (s.event.type === 'write' && s.event.value.k === 'ent' && s.event.value.label === label) return true;
    return s.event.type === 'opaque' && s.event.summary.includes(label);
}

export { isC };
