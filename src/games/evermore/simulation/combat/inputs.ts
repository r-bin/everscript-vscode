// Ownership: the numbers a fight simulation (fight.ts) needs, read from the ROM: an enemy's
// character record, the Boy's weapon entry and the Dog's form entry (their attack and knockback
// animations, timed by the animation VM), and the hit-chance table. The party's stats come from
// the route (they live in WRAM: records $0A26 / $0A70).

import { busU16 } from '../../../../platform/snes/hirom';
import { runAnimation } from '../../maps/animation-vm';
import { facingScript } from '../../maps/animation-table';
import { CHARACTER_TABLE, CHARACTER_STRIDE, ANIMATION_FIELDS, FACING_SOUTH } from '../../maps/character-record';
import { damageTable } from './fight';
import type { Duration, Fighter, FightSetup, HitChance } from './fight';
import type { Party } from './party';

/** The party member as the route states it (WRAM at the route's start). */
export interface PartyMember { name: string; hp: number; atk: number; def: number; evade: number; hitRate: number; chargeSpeed: number }

/** Weapon index → 36-byte entry in bank $C4 (rom/c43874): +$10 the attack at full charge, +$18 the knockback. */
const WEAPON_TABLE = 0xc43874, WEAPON_ATTACK1 = 0x10, WEAPON_KNOCKBACK = 0x18;
/** Dog form → entry in bank $CF (rom/8f9471, sprites/dog-forms.ts): slot 4 knockback, slot 6 the attack at full charge. */
const FORM_TABLE = 0xcf945f, FORM_SLOTS = 10, FORM_KNOCKBACK = 4, FORM_ATTACK1 = 6;
/** Hit chance: pointers by evade ($8F:BAAF), each to a row of words by hit rate in bank $8F, $7FFF = certain. */
const HIT_POINTERS = 0x8fbaaf, HIT_BANK = 0x8f0000;
/** Record fields the fight reads (rom/8eb678). */
const HP = 0x0f, CHANCE = 0x15, ATTACK = 0x19, DEFENSE = 0x1b, EVADE = 0x1f, HIT_RATE = 0x21, CHARGE_SPEED = 0x2e, NAME_FALLBACK = 'enemy';

/** An animation's length and the tick its first strike frame starts, from the animation VM. */
function swingOf(rom: Uint8Array, animId: number): Fighter['swing'] {
    const r = runAnimation(rom, facingScript(rom, animId, FACING_SOUTH), FACING_SOUTH);
    let at = 0, strikeAt = 0;
    for (const f of r.frames) { if (f.strikeBox) { strikeAt = at; break; } at += f.ticks; }
    return { ticks: r.totalTicks, strikeAt };
}

/** An animation's length as fixed ticks plus its `hold_random` (the VM ran the middle of the range). */
function durationOf(rom: Uint8Array, animId: number): Duration {
    const r = runAnimation(rom, facingScript(rom, animId, FACING_SOUTH), FACING_SOUTH);
    const f = r.frames.find((x) => x.random);
    if (!f || !f.random) return { ticks: r.totalTicks };
    const [lo, hi] = f.random, range = hi - lo + 1;
    return { ticks: r.totalTicks - (lo + (range >> 1)), random: { base: lo, range } };
}

export function hitChance(rom: Uint8Array): HitChance {
    return (hitRate, evade) => {
        const row = busU16(rom, HIT_POINTERS + (((evade + 1) >> 1) & 0xfffe));
        const raw = busU16(rom, HIT_BANK + row + (((hitRate + 1) & 0xfffc) >> 1));
        return Math.min(1, raw / 0x7fff);
    };
}

export function enemyFighter(rom: Uint8Array, character: number, name = NAME_FALLBACK): Fighter & { chance: number } {
    const rec = CHARACTER_TABLE + character * CHARACTER_STRIDE;
    const w = (field: number) => busU16(rom, rec + field);
    return {
        name, hp: w(HP), atk: w(ATTACK), def: w(DEFENSE), evade: w(EVADE), hitRate: w(HIT_RATE), chargeSpeed: w(CHARGE_SPEED), chance: w(CHANCE) & 0xff,
        swing: swingOf(rom, w(ANIMATION_FIELDS.attack1)), knockback: durationOf(rom, w(ANIMATION_FIELDS.damage)),
    };
}

export function boyFighter(rom: Uint8Array, m: PartyMember, weapon: number): Fighter {
    const entry = 0xc40000 | busU16(rom, WEAPON_TABLE + 2 * weapon);
    return { ...m, chance: null, swing: swingOf(rom, busU16(rom, entry + WEAPON_ATTACK1)), knockback: durationOf(rom, busU16(rom, entry + WEAPON_KNOCKBACK)) };
}

/** The Dog: an AI that attacks when full; its engage chance is the Dog record's (+$15). */
export function dogFighter(rom: Uint8Array, m: PartyMember, form: number): Fighter {
    const entry = 0xcf0000 | busU16(rom, FORM_TABLE + 2 * form);
    const slot = (s: number) => busU16(rom, entry + FORM_SLOTS + 2 * s);
    const chance = busU16(rom, CHARACTER_TABLE + CHARACTER_STRIDE + CHANCE) & 0xff;
    return { ...m, chance, swing: swingOf(rom, slot(FORM_ATTACK1)), knockback: durationOf(rom, slot(FORM_KNOCKBACK)) };
}

/** What the panel shows next to the result: who fights, and each pairing's hit chance and damage. */
export interface FightInputs {
    fighters: (Fighter & { role: string })[];
    pairs: { from: string; to: string; hit: number; min: number; max: number }[];
}

/**
 * The fight a step stands for: `fight` — the party members it names attack the enemy until it dies
 * ("Both" is the Boy and the Dog); `death` — the one it names stands in reach and does not attack
 * until the enemy has killed it.
 */
export function fightFor(rom: Uint8Array, party: Party, step: { kind: string; who?: string }, character: number, enemyName: string): { setup: FightSetup; inputs: FightInputs } | null {
    const hit = hitChance(rom);
    const enemy = enemyFighter(rom, character, enemyName);
    const boy = boyFighter(rom, { name: 'Boy', ...party.boy }, party.weapon);
    const dog = dogFighter(rom, { name: 'Dog', ...party.dog }, party.dogForm);
    const who = (step.who || 'Boy').toLowerCase();
    let setup: FightSetup;
    if (step.kind === 'fight') {
        const members = who === 'both' ? [boy, dog] : who === 'dog' ? [dog] : [boy];
        setup = { enemy, party: members.map((f) => ({ f, attacks: true })), until: 'enemy', hitChance: hit };
    } else if (step.kind === 'death') {
        setup = { enemy, party: [{ f: who === 'dog' ? dog : boy, attacks: false }], until: 'party', hitChance: hit };
    } else return null;
    const pair = (a: Fighter, b: Fighter) => {
        const t = damageTable(a.atk, b.def);
        let min = 999, max = 0;
        for (const d of t) { if (d < min) min = d; if (d > max) max = d; }
        return { from: a.name, to: b.name, hit: hit(a.hitRate, b.evade), min, max };
    };
    const pairs = setup.party.flatMap((p) => (p.attacks ? [pair(p.f, enemy)] : []).concat([pair(enemy, p.f)]));
    return { setup, inputs: { fighters: [{ ...enemy, role: 'enemy' }, ...setup.party.map((p) => ({ ...p.f, role: p.attacks ? 'attacks' : 'stands' }))], pairs } };
}
