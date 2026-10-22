// Ownership: a route as the Routes tab reads it — the file format (`*.route.json`), its
// validation, and the route played step by step (simulation/play.ts) into the view the page draws.
// Pure: room names and the triggers' cases are handed in.
//
// A route is an ordered list of actions (docs/plans/simulation/routes.md). A variant shares the
// route's first `after` steps and adds its own; without steps it is the route itself, named.

export type StepKind = 'start' | 'loot' | 'fight' | 'death' | 'exit' | 'wait' | 'enter';
import { freshState, playStep, triggerOf } from '../../simulation';
import type { RouteState, PlayTrigger, Verdict } from '../../simulation';
import { PARTY_STAT_KEYS } from '../../simulation/combat';
import type { Party, PartyStats } from '../../simulation/combat';

/** The party at the route's start, as WRAM holds it: what a fight simulation starts from. */
const STAT_KEYS = PARTY_STAT_KEYS;

function parseParty(raw: unknown, file: string, problems: string[]): Party | null {
    if (raw === undefined) return null;
    const stats = (v: unknown, who: string): PartyStats | null => {
        if (!isObj(v) || !STAT_KEYS.every((k) => typeof v[k] === 'number')) { problems.push(file + ': start.party.' + who + ' needs ' + STAT_KEYS.join(', ')); return null; }
        return Object.fromEntries(STAT_KEYS.map((k) => [k, v[k] as number])) as unknown as PartyStats;
    };
    if (!isObj(raw)) { problems.push(file + ': start.party is not an object'); return null; }
    const boy = stats(raw.boy, 'boy'), dog = stats(raw.dog, 'dog');
    if (!boy || !dog) return null;
    return { source: str(raw.source) || '', weapon: typeof raw.weapon === 'number' ? raw.weapon : 1, dogForm: typeof raw.dogForm === 'number' ? raw.dogForm : 0, boy, dog };
}

const KINDS: StepKind[] = ['start', 'loot', 'fight', 'death', 'exit', 'wait', 'enter'];

export interface RouteStep {
    room: number;
    kind: StepKind;
    action: string;
    who?: string;
    /** What the draft says the step gives or does, in its words. */
    claim?: string;
    /** Talons the draft says the step gives. */
    talons?: number;
    /** The trigger the step runs: "b1" (B-trigger #1), "step0" (step-on #0). */
    at?: string;
    /** The enemy the step is about: its index in the room's enter-script spawns. */
    enemy?: number;
    /** The room an exit step leads to. */
    to?: number;
    /** What is still to verify. */
    check?: string;
}

export interface RouteVariant { id: string; title: string; note?: string; after?: number; steps: RouteStep[] }

export interface Route {
    id: string;
    title: string;
    status: string;
    game: string;
    version: string;
    start: { room: number; note: string; party: Party | null };
    endpoint: string;
    source?: string;
    assumptions: string[];
    steps: RouteStep[];
    variants: RouteVariant[];
    questions: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => typeof v === 'string' && v.trim() ? v : undefined;
const strs = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** A room id written as "0x38" or 56. */
function roomId(v: unknown): number | null {
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^0x[0-9a-f]+$/i.test(v) ? parseInt(v, 16) : NaN;
    return Number.isInteger(n) && n >= 0 && n < 0x100 ? n : null;
}

function parseSteps(raw: unknown, where: string, problems: string[]): RouteStep[] {
    if (!Array.isArray(raw)) { if (raw !== undefined) problems.push(where + ': steps is not a list'); return []; }
    const out: RouteStep[] = [];
    raw.forEach((s, i) => {
        const at = where + ' step ' + (i + 1);
        if (!isObj(s)) { problems.push(at + ': not an object'); return; }
        const room = roomId(s.room);
        const kind = KINDS.find((k) => k === s.kind);
        const action = str(s.action);
        if (room === null) { problems.push(at + ': room must be a room id like "0x38"'); return; }
        if (!kind) { problems.push(at + ': kind must be one of ' + KINDS.join(', ')); return; }
        if (!action) { problems.push(at + ': action is missing'); return; }
        const step: RouteStep = { room, kind, action };
        if (str(s.who)) step.who = s.who as string;
        if (str(s.claim)) step.claim = s.claim as string;
        if (typeof s.talons === 'number') step.talons = s.talons;
        if (str(s.at)) { if (triggerOf(s.at as string)) step.at = s.at as string; else problems.push(at + ': at must be a trigger like "b1" or "step0"'); }
        if (typeof s.enemy === 'number' && s.enemy >= 0) step.enemy = s.enemy;
        if (str(s.check)) step.check = s.check as string;
        if (s.to !== undefined) {
            const to = roomId(s.to);
            if (to === null) problems.push(at + ': to must be a room id'); else step.to = to;
        }
        if (kind === 'exit' && step.to === undefined) problems.push(at + ': an exit names the room it leads to (to)');
        out.push(step);
    });
    return out;
}

/** A route file read and checked; what is wrong is listed, never guessed around. */
export function parseRoute(raw: unknown, file: string): { route: Route | null; problems: string[] } {
    const problems: string[] = [];
    if (!isObj(raw)) return { route: null, problems: [file + ': not a JSON object'] };
    const id = str(raw.id), title = str(raw.title);
    const start = isObj(raw.start) ? raw.start : {};
    const startRoom = roomId(start.room);
    if (!id || !title) problems.push(file + ': id and title are required');
    if (startRoom === null) problems.push(file + ': start.room must be a room id');
    const steps = parseSteps(raw.steps, file, problems);
    const variants: RouteVariant[] = [];
    (Array.isArray(raw.variants) ? raw.variants : []).forEach((v, i) => {
        if (!isObj(v) || !str(v.id) || !str(v.title)) { problems.push(file + ': variant ' + (i + 1) + ' needs an id and a title'); return; }
        const after = typeof v.after === 'number' && v.after >= 0 && v.after <= steps.length ? v.after : undefined;
        if (v.after !== undefined && after === undefined) problems.push(file + ': variant ' + v.id + ': after must be 0..' + steps.length);
        variants.push({ id: v.id as string, title: v.title as string, note: str(v.note), after, steps: parseSteps(v.steps, file + ' variant ' + v.id, problems) });
    });
    if (!id || !title || startRoom === null) return { route: null, problems };
    return {
        route: {
            id, title, status: str(raw.status) || 'draft', game: str(raw.game) || 'evermore', version: str(raw.version) || 'not stated',
            start: { room: startRoom, note: str(start.note) || '', party: parseParty(start.party, file, problems) }, endpoint: str(raw.endpoint) || 'not specified', source: str(raw.source),
            assumptions: strs(raw.assumptions), steps, variants, questions: strs(raw.questions),
        },
        problems,
    };
}

const hex = (n: number): string => '0x' + n.toString(16).padStart(2, '0').toUpperCase();

export interface StepView extends RouteStep {
    n: number; inherited: boolean; toName?: string;
    effects: string[]; assumed: string[]; verdict: Verdict; note: string;
    /** The state after the step. */
    after: RouteState;
}
export interface RouteView {
    id: string; routeId: string; title: string; note: string; base: string | null;
    route: Omit<Route, 'steps' | 'variants'>; startName: string;
    steps: StepView[];
    totals: { steps: number; rooms: number; talons: number; open: number; ok: number; differs: number; missing: number };
}

export interface Names { name(room: number): string; area(room: number): string }
/** The simulation's cases of one trigger of a room; null when the room has no such trigger, undefined without a ROM. */
export type Triggers = (room: number, at: string) => PlayTrigger | null | undefined;

/** The route and each variant, played from a fresh game: every step with its effects and the state after it. */
export function routeViews(route: Route, names: Names, triggers: Triggers): RouteView[] {
    const { steps, variants, ...meta } = route;
    const lines: { id: string; title: string; note: string; base: string | null; steps: RouteStep[]; shared: number }[] = [
        { id: route.id, title: route.title, note: '', base: null, steps, shared: 0 },
        ...variants.map((v) => {
            const shared = v.steps.length ? v.after ?? steps.length : steps.length;
            return { id: route.id + '/' + v.id, title: v.title, note: v.note || '', base: route.title, steps: steps.slice(0, shared).concat(v.steps), shared };
        }),
    ];
    return lines.map((l) => {
        let state = freshState(route.start.room);
        const totals = { steps: l.steps.length, rooms: 0, talons: 0, open: 0, ok: 0, differs: 0, missing: 0 };
        const views = l.steps.map((s, i): StepView => {
            const r = playStep(s, state, s.at ? triggers(s.room, s.at) : null);
            state = r.state;
            if (r.verdict !== 'none') totals[r.verdict]++;
            if (s.check) totals.open++;
            const view: StepView = { ...s, n: i + 1, inherited: l.base !== null && i < l.shared, effects: r.effects, assumed: r.assumed, verdict: r.verdict, note: r.note, after: r.state };
            if (s.to !== undefined) view.toName = names.name(s.to);
            return view;
        });
        totals.rooms = new Set(l.steps.map((s) => s.room)).size;
        totals.talons = state.talons;
        return { id: l.id, routeId: route.id, title: l.title, note: l.note, base: l.base, route: meta, startName: names.name(route.start.room), steps: views, totals };
    });
}
