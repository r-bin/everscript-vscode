// Ownership: a route played step by step against one WRAM (docs/plans/simulation/interaction.md:
// "run its script against the WRAM, show what changed"). Pure: each trigger's cases come from the
// simulation (simulation/ `analyze`), handed in.
//
// A step that names a trigger (`at`) runs it: the case whose conditions hold in the current state
// is applied — the loot goes into its inventory byte, its taken flag is set, the room object is
// marked opened, a map change moves the party. Bytes nothing has written are 0: the fresh-game
// assumption every route states. What the scripts do not decide (enemy drops, a move between rooms
// no script makes) is applied as drafted and labelled so.

/** What playing a step reads of it (model/route.ts RouteStep). */
interface PlayedStep { room: number; who?: string; at?: string; talons?: number; to?: number }

/** A symbolic value as the simulation writes it (simulation/sym.ts), as far as this reads it. */
export interface Sym { k: string; v?: number; addr?: number; size?: number; label?: string; name?: string; op?: string; a?: Sym; b?: Sym; bit?: number }
export interface Condition { cond: Sym; value: boolean; text: string }
export interface TriggerCase {
    label: string; when: Condition[]; mapId: number | null;
    loot: { itemName: string | null; object: number | null; looted: boolean; amount: Sym; slot: number | null; flagsSet: { addr: number; bit: number }[] } | null;
}
export interface TriggerAnalysis { cases: TriggerCase[]; always: Condition[]; otherwise: { when: Condition[]; note: string }[] }

export interface RouteState {
    room: number;
    /** WRAM bytes written so far, by address; everything else is 0. */
    wram: Record<number, number>;
    talons: number;
    items: Record<string, number>;
    /** Flags set, with the name the scripts give them. */
    flags: { addr: number; bit: number; name: string }[];
    /** Room objects opened by a pickup, per room. */
    opened: Record<number, number[]>;
}

export type Verdict = 'ok' | 'differs' | 'missing' | 'none';
export interface StepResult { effects: string[]; assumed: string[]; verdict: Verdict; note: string; state: RouteState }

/** A trigger key ("b1", "step0") as the simulation names its type. */
export function triggerOf(key: string): { type: 'b-button' | 'step-on'; index: number } | null {
    const m = /^(b|step)(\d+)$/.exec(key);
    return m ? { type: m[1] === 'b' ? 'b-button' : 'step-on', index: Number(m[2]) } : null;
}

export function freshState(room: number): RouteState {
    return { room, wram: {}, talons: 0, items: {}, flags: [], opened: {} };
}

const clone = (s: RouteState): RouteState => ({
    room: s.room, wram: { ...s.wram }, talons: s.talons, items: { ...s.items }, flags: s.flags.slice(),
    opened: Object.fromEntries(Object.entries(s.opened).map(([k, v]) => [k, v.slice()])),
});
const hex2 = (n: number): string => '0x' + n.toString(16).padStart(2, '0').toUpperCase();
const ram = (n: number): string => '$' + n.toString(16).toUpperCase();
const word = (item: string): string => item.charAt(0) + item.slice(1).toLowerCase().replace(/_/g, ' ');

type Val = number | 'boy' | 'dog' | null;

function value(e: Sym | undefined, s: RouteState, who: 'boy' | 'dog'): Val {
    if (!e) return null;
    if (e.k === 'c' && typeof e.v === 'number') return e.v;
    if (e.k === 'mem' && typeof e.addr === 'number') {
        const lo = s.wram[e.addr] || 0;
        return e.size === 2 ? lo | ((s.wram[e.addr + 1] || 0) << 8) : lo;
    }
    if (e.k === 'ent' && (e.label === 'boy' || e.label === 'dog')) return e.label;
    if (e.k === 'atom' && e.name === 'controlled char') return who;
    return null;
}

/** Whether a condition holds in the state: true, false, or null when the state cannot say. */
export function holds(c: Sym, s: RouteState, who: 'boy' | 'dog'): boolean | null {
    if (c.k === 'bit' && typeof c.bit === 'number') {
        const v = value(c.a, s, who);
        return typeof v === 'number' ? ((v >> c.bit) & 1) === 1 : null;
    }
    if (c.k === 'bin') {
        const a = value(c.a, s, who), b = value(c.b, s, who);
        if (a === null || b === null) return null;
        if (c.op === '==') return a === b;
        if (c.op === '!=') return a !== b;
        if (typeof a !== 'number' || typeof b !== 'number') return null;
        return c.op === '<' ? a < b : c.op === '<=' ? a <= b : c.op === '>' ? a > b : c.op === '>=' ? a >= b : null;
    }
    return null;
}

/** The case that applies: every condition holds, or cannot be decided (then it is listed as assumed). */
function pick(t: TriggerAnalysis, s: RouteState, who: 'boy' | 'dog'): { c: TriggerCase; assumed: string[] } | null {
    let best: { c: TriggerCase; assumed: string[] } | null = null;
    for (const c of t.cases) {
        const assumed: string[] = [];
        let fails = false;
        for (const cond of t.always.concat(c.when)) {
            const h = holds(cond.cond, s, who);
            if (h === null) assumed.push(cond.text);
            else if (h !== cond.value) { fails = true; break; }
        }
        if (!fails && (!best || assumed.length < best.assumed.length)) best = { c, assumed };
    }
    return best;
}

/** The name the trigger's own conditions give a flag ("Gourd in south Jungle"), or its address. */
function flagName(t: TriggerAnalysis, addr: number, bit: number): string {
    const tag = ram(addr).toLowerCase() + '&0x' + (1 << bit).toString(16).padStart(2, '0');
    const text = t.always.concat(...t.cases.map((c) => c.when)).map((c) => c.text).find((x) => x.toLowerCase().indexOf(tag) >= 0);
    return text ? text.replace(/^not /, '') : ram(addr) + ' bit ' + bit;
}

function apply(t: TriggerAnalysis, c: TriggerCase, s: RouteState, effects: string[]): void {
    const l = c.loot;
    if (l) {
        const n = l.amount.k === 'c' && typeof l.amount.v === 'number' ? l.amount.v : 1;
        if (l.itemName === 'MONEY') { s.talons += n; effects.push('+' + n + ' Talons → ' + s.talons); }
        else {
            const name = l.itemName || '?';
            s.items[name] = (s.items[name] || 0) + n;
            if (l.slot !== null) s.wram[l.slot] = ((s.wram[l.slot] || 0) + n) & 0xff;
            effects.push('+' + n + ' ' + word(name) + (l.slot !== null ? ' (' + ram(l.slot) + ' = ' + s.wram[l.slot] + ')' : ''));
        }
        for (const f of l.flagsSet) {
            s.wram[f.addr] = (s.wram[f.addr] || 0) | (1 << f.bit);
            const name = flagName(t, f.addr, f.bit);
            if (!s.flags.some((x) => x.addr === f.addr && x.bit === f.bit)) s.flags.push({ addr: f.addr, bit: f.bit, name });
            effects.push('set ' + name);
        }
        if (l.looted && l.object !== null) {
            const list = s.opened[s.room] || (s.opened[s.room] = []);
            if (list.indexOf(l.object) < 0) list.push(l.object);
            effects.push('room object ' + l.object + ' opened');
        }
    }
    if (c.mapId !== null) { s.room = c.mapId; effects.push('→ room ' + hex2(c.mapId)); }
}

/** One step from a state: its effects, what had to be assumed, and whether the draft agrees. */
/** `trigger`: the cases of the trigger the step names; null when the room has none, undefined without a ROM. */
export function playStep(step: PlayedStep, before: RouteState, trigger: TriggerAnalysis | null | undefined): StepResult {
    const s = clone(before);
    const effects: string[] = [];
    const who = step.who && /^dog/i.test(step.who) ? 'dog' : 'boy';
    if (s.room !== step.room) {
        effects.push('moved ' + hex2(s.room) + ' → ' + hex2(step.room) + ' (no script in the route does this)');
        s.room = step.room;
    }
    const moved = effects.length > 0;
    if (step.at && trigger) {
        const hit = pick(trigger, s, who);
        if (!hit) {
            const why = trigger.otherwise.map((o) => o.note).filter(Boolean)[0] || 'no case of the script applies';
            return { effects, assumed: [], verdict: 'missing', note: 'In this state the script does nothing: ' + why + '.', state: s };
        }
        apply(trigger, hit.c, s, effects);
        const gave = hit.c.loot && hit.c.loot.itemName === 'MONEY' ? hit.c.loot : null;
        const amount = gave && gave.amount.k === 'c' ? gave.amount.v : undefined;
        const problems: string[] = [];
        if (step.talons !== undefined && amount !== step.talons) problems.push('the draft says +' + step.talons + ' Talons; the script gives ' + hit.c.label.replace(/ × (\w+)/, (_, x) => ' × ' + word(x)));
        if (step.to !== undefined && hit.c.mapId !== step.to) problems.push('the draft goes to ' + hex2(step.to) + '; the script ' + (hit.c.mapId === null ? 'changes no map' : 'goes to ' + hex2(hit.c.mapId)));
        return { effects, assumed: hit.assumed, verdict: problems.length ? 'differs' : 'ok', note: problems.length ? capital(problems.join('; ')) + '.' : 'The script agrees: ' + hit.c.label.replace(/ × (\w+)/, (_, x) => ' × ' + word(x)) + '.', state: s };
    }
    if (step.at && trigger === undefined) return { effects, assumed: [], verdict: 'none', note: 'No ROM: the script was not run.', state: s };
    if (step.at && !trigger) return { effects, assumed: [], verdict: 'missing', note: 'Room ' + hex2(step.room) + ' has no trigger ' + step.at + '.', state: s };
    if (step.talons) { s.talons += step.talons; effects.push('+' + step.talons + ' Talons → ' + s.talons + ' (as drafted; drops are not simulated)'); }
    return { effects, assumed: [], verdict: moved ? 'missing' : 'none', note: moved ? 'No script in the route moves the party here; the move is still to trace.' : 'Not a script: nothing to run.', state: s };
}

const capital = (x: string): string => x.charAt(0).toUpperCase() + x.slice(1);
