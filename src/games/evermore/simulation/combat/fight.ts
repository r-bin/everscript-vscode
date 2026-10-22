// Ownership: a melee fight played tick by tick, many times, into distributions. Pure: every
// number comes in as `Fighter` (inputs.ts reads them from the ROM and the party). The game's rules
// behind each step: docs/entities/combat.md.
//
// What one tick does, from the game's own code (knowledge rom/8fcc40, rom/8fba06, rom/8fd69b):
// - Charge: +speed a tick up to $400 while not attacking (the attack's `mode` has bit $10,
//   which stops it; knockback does not). An attack's last command (`4E`) empties it, so an
//   attack cut short by a hit keeps its charge.
// - Attacking: the Boy swings as soon as he is full (the player); the Dog and the enemy roll
//   `rand(0..255) < chance` each idle tick once full (the enemy picks the Boy first when he is in
//   range, else the Dog).
// - A swing rolls to hit once, on its first strike frame (the target keeps the attacker for 20
//   ticks, longer than the later strike frames), with the ROM's hit-chance table; the damage is
//   the physical formula's roll; the target enters its knockback (its `hold_random` wait) and an
//   attack it was in is cancelled. Knockback does not protect: its `mode` has no bit $20.
// - Damage is taken on the target's next tick.

export interface Duration { ticks: number; random?: { base: number; range: number } }
export interface Fighter {
    name: string;
    hp: number; atk: number; def: number; evade: number; hitRate: number;
    /** Charge added a tick, to $400. */
    chargeSpeed: number;
    /** Per idle tick when full: `rand(0..255) < chance` (an AI); null for the player, who swings when full. */
    chance: number | null;
    /** The attack at full charge: its length and the tick its first strike frame starts. */
    swing: { ticks: number; strikeAt: number };
    /** The knockback animation: fixed ticks plus a `hold_random` part. */
    knockback: Duration;
}
/** Hit chance in 0..1 for an attacker's hit rate against a target's evade (the ROM's table). */
export type HitChance = (hitRate: number, evade: number) => number;

const FULL = 0x400;
const TICKS_PER_SECOND = 60;

/** The physical damage roll (scaling/webview/alchemy-math.js damageRangeFull): one value per 16-bit random. */
export function damageTable(atk: number, def: number): Uint16Array {
    let w = (atk - (def >> 2)) & 0xffff;
    if (w < 1 || w >= 0x8000) w = 1;
    const w2 = (w + 1) & 0xffff;
    const out = new Uint16Array(0x10000);
    for (let r = 0; r <= 0xffff; r++) {
        const a = ((Math.floor((w2 * r) / 0x10000) & 0xffff) + w) & 0xffff;
        const c = (((a << 1) & 0xffff) + w + ((a & 0x8000) ? 1 : 0)) & 0xffff;
        out[r] = Math.min(999, c >>> 2);
    }
    return out;
}

/** A small seeded generator (mulberry32), so a result can be reproduced. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** `hold_random`: base + the high byte of range × a random byte. */
const sampleDuration = (d: Duration, rand: () => number): number =>
    d.ticks + (d.random ? d.random.base + ((d.random.range * Math.floor(rand() * 256)) >> 8) : 0);

interface Actor {
    f: Fighter; side: 'party' | 'enemy'; hp: number; charge: number; pending: number;
    state: 'idle' | 'swing' | 'knock'; t: number; left: number; target: Actor | null; attacks: boolean;
    swings: number; landed: number; misses: number; knocked: number; damage: Uint16Array[];
}

export interface FightSetup {
    /** Who attacks and who is there: the enemy, and the party members in its range. */
    enemy: Fighter;
    party: { f: Fighter; attacks: boolean }[];
    /** The fight ends when the enemy's HP reaches 0, or the first party member's. */
    until: 'enemy' | 'party';
    hitChance: HitChance;
}
export interface FightRun { ticks: number; enemySwings: number; enemyLanded: number; party: { swings: number; landed: number; knocked: number }[] }

const MAX_TICKS = 60 * TICKS_PER_SECOND;

/** One fight from the first tick, everyone full and in range. Null if nobody died in a minute. */
export function fightOnce(setup: FightSetup, rand: () => number): FightRun | null {
    const make = (f: Fighter, side: Actor['side'], attacks: boolean): Actor => ({
        f, side, hp: f.hp, charge: FULL, pending: 0, state: 'idle', t: 0, left: 0, target: null, attacks, swings: 0, landed: 0, misses: 0, knocked: 0, damage: [],
    });
    const enemy = make(setup.enemy, 'enemy', true);
    const party = setup.party.map((p) => make(p.f, 'party', p.attacks));
    const tables = new Map<string, Uint16Array>();
    const table = (a: Actor, b: Actor) => {
        const key = a.f.atk + ':' + b.f.def;
        if (!tables.has(key)) tables.set(key, damageTable(a.f.atk, b.f.def));
        return tables.get(key)!;
    };
    const watched = setup.until === 'enemy' ? enemy : party[0];
    const all = [enemy, ...party];
    for (let tick = 0; tick < MAX_TICKS; tick++) {
        for (const a of all) {
            if (a.pending) { a.hp = Math.max(0, a.hp - a.pending); a.pending = 0; }
            if (watched.hp === 0) return { ticks: tick, enemySwings: enemy.swings, enemyLanded: enemy.landed, party: party.map((p) => ({ swings: p.swings, landed: p.landed, knocked: p.knocked })) };
            if (a.hp === 0) continue;
            if (a.state !== 'swing' && a.charge < FULL) a.charge = Math.min(FULL, a.charge + a.f.chargeSpeed);
            if (a.state === 'knock') { if (--a.left <= 0) a.state = 'idle'; continue; }
            if (a.state === 'swing') {
                a.t++;
                if (a.t === a.f.swing.strikeAt && a.target && a.target.hp > 0) {
                    const b = a.target;
                    if (rand() < setup.hitChance(a.f.hitRate, b.f.evade)) {
                        a.landed++;
                        b.pending += table(a, b)[Math.floor(rand() * 0x10000)];
                        b.state = 'knock'; b.left = sampleDuration(b.f.knockback, rand); b.knocked++;
                    } else a.misses++;
                }
                if (a.t >= a.f.swing.ticks) { a.state = 'idle'; a.charge = 0; }
                continue;
            }
            if (!a.attacks || a.charge < FULL) continue;
            let target: Actor | null = null;
            if (a.side === 'party') target = enemy.hp > 0 ? enemy : null;
            else target = party.find((p) => p.hp > 0) || null;
            if (!target) continue;
            if (a.f.chance !== null && Math.floor(rand() * 256) >= a.f.chance) continue;
            a.state = 'swing'; a.t = 0; a.target = target; a.swings++;
        }
    }
    return null;
}

export interface Histogram { bins: { from: number; to: number; count: number }[]; total: number }
export interface Stats { min: number; p10: number; median: number; mean: number; p90: number; max: number }

function stats(values: number[]): Stats {
    const v = values.slice().sort((a, b) => a - b);
    const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
    return { min: v[0], p10: q(0.1), median: q(0.5), mean: v.reduce((s, x) => s + x, 0) / v.length, p90: q(0.9), max: v[v.length - 1] };
}

function histogram(values: number[], width: number): Histogram {
    const lo = Math.floor(Math.min(...values) / width) * width, hi = Math.max(...values);
    const bins: Histogram['bins'] = [];
    for (let x = lo; x <= hi; x += width) bins.push({ from: x, to: x + width, count: 0 });
    for (const v of values) bins[Math.min(bins.length - 1, Math.floor((v - lo) / width))].count++;
    return { bins, total: values.length };
}

/** Counts of a whole-number outcome, in order: [[value, count], …]. */
function counts(values: number[]): [number, number][] {
    const m = new Map<number, number>();
    for (const v of values) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

export interface FightReport {
    runs: number; unfinished: number;
    /** Seconds until the fight ends. */
    seconds: { histogram: Histogram; stats: Stats; best: number };
    /** How many hits landed on the one who dies, and how many swings it took. */
    hits: [number, number][]; swings: [number, number][];
    /** Per party member: share of fights in which it was knocked back at least once. */
    knocked: number[];
}

/**
 * Many fights: the time until the watched side dies, as seconds, with the best case the dice
 * allow (every roll its best: at once, every swing a hit for the most damage, the shortest waits).
 */
export function simulateFight(setup: FightSetup, runs = 10000, seed = 1): FightReport {
    const rand = rng(seed);
    const secs: number[] = [], hits: number[] = [], swings: number[] = [];
    const knocked = setup.party.map(() => 0);
    let unfinished = 0;
    for (let i = 0; i < runs; i++) {
        const r = fightOnce(setup, rand);
        if (!r) { unfinished++; continue; }
        secs.push(r.ticks / TICKS_PER_SECOND);
        if (setup.until === 'enemy') {
            hits.push(r.party.reduce((s, p) => s + p.landed, 0));
            swings.push(r.party.reduce((s, p) => s + p.swings, 0));
        } else { hits.push(r.enemyLanded); swings.push(r.enemySwings); }
        r.party.forEach((p, k) => { if (p.knocked) knocked[k]++; });
    }
    // About 40 bins at a round width.
    const spread = Math.max(...secs) - Math.min(...secs);
    const width = [0.05, 0.1, 0.25, 0.5, 1, 2, 5].find((w) => spread / w <= 40) || 10;
    return {
        runs, unfinished,
        seconds: { histogram: histogram(secs, width), stats: stats(secs), best: bestCase(setup) / TICKS_PER_SECOND },
        hits: counts(hits), swings: counts(swings), knocked: knocked.map((k) => k / Math.max(1, runs - unfinished)),
    };
}

/** The shortest fight the rules allow: every roll as good as it gets. */
export function bestCase(setup: FightSetup): number {
    const maxDamage = (a: Fighter, b: Fighter) => Math.max(...damageTable(a.atk, b.def));
    if (setup.until === 'enemy') {
        // Everyone swings at tick 0 and hits for the most; strikes land in order of their strike tick.
        const strikes = setup.party.filter((p) => p.attacks).map((p) => ({ at: p.f.swing.strikeAt, dmg: maxDamage(p.f, setup.enemy), cycle: p.f.swing.ticks + Math.ceil(FULL / p.f.chargeSpeed) }));
        let hp = setup.enemy.hp;
        for (let n = 0; n < 50; n++) {
            const due = strikes.map((s) => ({ at: s.at + n * s.cycle, dmg: s.dmg })).sort((a, b) => a.at - b.at);
            for (const d of due) { hp -= d.dmg; if (hp <= 0) return d.at + 1; }
        }
        return NaN;
    }
    const e = setup.enemy, boy = setup.party[0].f;
    const hitsNeeded = Math.ceil(boy.hp / maxDamage(e, boy));
    const cycle = e.swing.ticks + Math.ceil(FULL / e.chargeSpeed);
    return e.swing.strikeAt + (hitsNeeded - 1) * cycle + 1;
}
