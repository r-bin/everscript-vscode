// Ownership: a route as the Routes tab reads it — the file format (`*.route.json`), its
// validation, the check of each step against what the room's scripts do, and the view the page
// draws. Pure: room names and room facts are handed in.
//
// A route is an ordered list of actions (docs/plans/simulation/routes.md). A variant shares the
// route's first `after` steps and adds its own; without steps it is the route itself, named.

export type StepKind = 'start' | 'loot' | 'fight' | 'death' | 'exit' | 'wait' | 'enter';
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
    /** The reward a loot step expects, as the room scripts name it (PETAL, NECTAR, MONEY). */
    loot?: string;
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
    start: { room: number; note: string };
    endpoint: string;
    source?: string;
    assumptions: string[];
    steps: RouteStep[];
    variants: RouteVariant[];
    questions: string[];
}

/** What a room's scripts give and where they lead (script-model loot and doors), per trigger. */
export interface RoomFacts {
    loot: { trigger: string; kind: string; item: string; amount: number }[];
    exits: { trigger: string; to: number }[];
}

export type CheckState = 'ok' | 'differs' | 'missing' | 'none';
export interface StepCheck { state: CheckState; text: string }

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
        if (str(s.loot)) step.loot = (s.loot as string).toUpperCase();
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
            start: { room: startRoom, note: str(start.note) || '' }, endpoint: str(raw.endpoint) || 'not specified', source: str(raw.source),
            assumptions: strs(raw.assumptions), steps, variants, questions: strs(raw.questions),
        },
        problems,
    };
}

const hex = (n: number): string => '0x' + n.toString(16).padStart(2, '0').toUpperCase();
const itemWord = (item: string): string => item.charAt(0) + item.slice(1).toLowerCase().replace(/_/g, ' ');
const lootText = (l: RoomFacts['loot'][number]): string => l.item === 'MONEY' ? l.amount + ' Talons' : l.amount + ' × ' + itemWord(l.item);

/** A step against its room's scripts: does the loot it names exist and give what it says, does the exit lead there. */
export function checkStep(step: RouteStep, facts: RoomFacts | null): StepCheck {
    if (!facts) return { state: 'none', text: 'No ROM: not checked.' };
    if (step.kind === 'exit' && step.to !== undefined) {
        const hits = facts.exits.filter((e) => e.to === step.to);
        return hits.length
            ? { state: 'ok', text: 'Leads to ' + hex(step.to) + ': ' + hits.map((h) => h.trigger).join(', ') + '.' }
            : { state: 'missing', text: 'No script in ' + hex(step.room) + ' changes the map to ' + hex(step.to) + '; the move comes from elsewhere (a global or cutscene script), or the step is wrong.' };
    }
    if (step.kind === 'loot' && step.loot) {
        const hits = facts.loot.filter((l) => l.item === step.loot);
        if (!hits.length) return { state: 'missing', text: 'No pickup in ' + hex(step.room) + ' gives ' + itemWord(step.loot) + '.' };
        const gives = hits.map((h) => h.trigger + ' gives ' + lootText(h)).join('; ');
        const talonsOk = step.talons === undefined || hits.some((h) => h.item === 'MONEY' && h.amount === step.talons);
        if (talonsOk) return { state: 'ok', text: gives + '.' };
        const money = facts.loot.filter((l) => l.item === 'MONEY');
        return { state: 'differs', text: 'The draft says +' + step.talons + ' Talons; ' + gives + '.' +
            (money.length ? ' Money in this room: ' + money.map((m) => m.trigger + ' ' + m.amount + ' Talons').join(', ') + '.' : '') };
    }
    return { state: 'none', text: 'Nothing in the room scripts to check this against.' };
}

export interface StepView extends RouteStep { n: number; tally: number; toName?: string; rom: StepCheck; inherited: boolean }
export interface RoomRun { room: number; hex: string; name: string; area: string; steps: StepView[] }
export interface RouteView {
    id: string; routeId: string; title: string; note: string; base: string | null;
    route: Omit<Route, 'steps' | 'variants'>; startName: string;
    runs: RoomRun[];
    totals: { steps: number; rooms: number; talons: number; open: number; ok: number; differs: number; missing: number };
    facts: Record<string, RoomFacts>;
}

export interface Names { name(room: number): string; area(room: number): string }

/** The route and each variant as the page draws them: steps in runs of one room, the drafted Talons carried forward, each step checked. */
export function routeViews(route: Route, names: Names, factsOf: (room: number) => RoomFacts | null): RouteView[] {
    const { steps, variants, ...meta } = route;
    const lines: { id: string; title: string; note: string; base: string | null; steps: RouteStep[]; shared: number }[] = [
        { id: route.id, title: route.title, note: '', base: null, steps, shared: 0 },
        ...variants.map((v) => {
            const shared = v.steps.length ? v.after ?? steps.length : steps.length;
            return { id: route.id + '/' + v.id, title: v.title, note: v.note || '', base: route.title, steps: steps.slice(0, shared).concat(v.steps), shared };
        }),
    ];
    return lines.map((l) => {
        const facts: Record<string, RoomFacts> = {};
        const runs: RoomRun[] = [];
        let tally = 0;
        const totals = { steps: l.steps.length, rooms: 0, talons: 0, open: 0, ok: 0, differs: 0, missing: 0 };
        l.steps.forEach((s, i) => {
            const f = factsOf(s.room);
            if (f) facts[hex(s.room)] = f;
            tally += s.talons || 0;
            const rom = checkStep(s, f);
            if (rom.state === 'ok' || rom.state === 'differs' || rom.state === 'missing') totals[rom.state]++;
            if (s.check) totals.open++;
            const view: StepView = { ...s, n: i + 1, tally, rom, inherited: l.base !== null && i < l.shared };
            if (s.to !== undefined) view.toName = names.name(s.to);
            const last = runs[runs.length - 1];
            if (last && last.room === s.room) last.steps.push(view);
            else runs.push({ room: s.room, hex: hex(s.room), name: names.name(s.room), area: names.area(s.room), steps: [view] });
        });
        totals.rooms = new Set(runs.map((r) => r.room)).size;
        totals.talons = tally;
        return { id: l.id, routeId: route.id, title: l.title, note: l.note, base: l.base, route: meta, startName: names.name(route.start.room), runs, totals, facts };
    });
}
