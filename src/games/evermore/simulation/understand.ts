// Ownership: reading meaning out of a finished path — what changed in WRAM
// and what that amounts to (an item counted up, a flag set). Pure.
//
// Nothing here pattern-matches script *bytes*. It reads the path's end state:
// "$231c went from n to n+1 and the loot-successful bit is set" means one
// Call Beads was looted, no matter which instructions got there. That is the
// point of simulating rather than decoding — the global loot scripts do the
// counting, and the simulation watches them do it.

import { Sym, c, key, ramHex, isC, bin } from './sym';
import { SimPath } from './explore';
import { Decoder } from './machine';
import { Pin } from './memory';

/** WRAM the loot scripts use as a mailbox, not as inventory. */
export const LOOT = {
    ITEM: 0x2391, CURRENCY_AMOUNT: 0x2393, OBJECT: 0x2395, BONUS: 0x2461,
    SUCCESS: 0x22ea, SUCCESS_BIT: 0, TEXT_ARG: 0x2539, TEXT_ARG2: 0x2537,
};
/** The global loot drivers: sniff spot, gourd/chest, and the second gourd variant. */
export const LOOT_DRIVERS = new Set([0x39, 0x3a, 0x3b]);
const MAILBOX = new Set([LOOT.ITEM, LOOT.CURRENCY_AMOUNT, LOOT.OBJECT, LOOT.BONUS, LOOT.TEXT_ARG, LOOT.TEXT_ARG2]);

/**
 * The starting state every pickup in the game leaves behind: both loot
 * drivers end by writing 0 to `$2461`, so between pickups it is 0 unless a
 * script just staged a bonus. Pass it as `pins` and say so in the report —
 * it is an assumption, not a fact about every moment.
 */
export const PINS_BETWEEN_PICKUPS: readonly Pin[] = [
    { addr: LOOT.BONUS, value: 0, why: 'loot bonus is 0 between pickups (both loot drivers reset it)' },
    { addr: LOOT.BONUS + 1, value: 0, why: 'loot bonus is 0 between pickups (both loot drivers reset it)' },
];

export type Change =
    | { addr: number; kind: 'add'; amount: Sym }
    | { addr: number; kind: 'bits'; bits: Array<{ bit: number; value: Sym }> }
    | { addr: number; kind: 'set'; size: 1 | 2; value: Sym };

/** The end state, read as increments, flag changes and plain stores. */
export function changes(p: SimPath): Change[] {
    const out: Change[] = [];
    for (const d of p.diff) {
        const v = d.value.k === 'lo' ? d.value.a : d.value;
        if (v.k === 'bin' && v.op === '+' && v.a.k === 'mem' && v.a.addr === d.addr) {
            out.push({ addr: d.addr, kind: 'add', amount: v.b });
            continue;
        }
        const bits: Array<{ bit: number; value: Sym }> = [];
        let x: Sym = d.value;
        while (x.k === 'setbit') { bits.unshift({ bit: x.bit, value: x.v }); x = x.a; }
        if (bits.length && x.k === 'mem' && x.addr === d.addr) out.push({ addr: d.addr, kind: 'bits', bits });
        else out.push({ addr: d.addr, kind: 'set', size: d.size, value: d.value });
    }
    return out;
}

export interface LootOutcome {
    /** `LOOT_ITEM` the trigger staged, and its name. */
    item: number;
    itemName: string;
    object: number | null;
    /** Whether the pickup went through: the loot-successful bit at the end. */
    looted: boolean;
    /** How much was added, and where — the inventory slot the game counted up. */
    amount: Sym | null;
    slot: number | null;
    /** Persistent "already taken" flags this path set. */
    flagsSet: Array<{ addr: number; bit: number }>;
}

/** What a pickup path gave, or null when the path staged no loot. */
export function lootOutcome(p: SimPath, dec: Decoder): LootOutcome | null {
    // What the mailbox held when a loot driver was called — at any depth, since
    // some rooms stage the pickup in a subroutine (Dark Forest picks one per variant).
    let item: number | null = null;
    let object: number | null = null;
    let staged: number | null = null, stagedObject: number | null = null;
    for (const st of p.steps) {
        if (st.kind !== 'event') continue;
        const e = st.event;
        if (e.type === 'write' && e.addr === LOOT.ITEM) staged = isC(e.value) ? e.value.v : null;
        if (e.type === 'write' && e.addr === LOOT.OBJECT) stagedObject = isC(e.value) ? e.value.v : null;
        if (e.type === 'call' && e.global !== null && LOOT_DRIVERS.has(e.global) && staged !== null) { item = staged; object = stagedObject; }
    }
    if (item === null) return null;
    const ch = changes(p);
    const success = ch.find((x) => x.addr === LOOT.SUCCESS && x.kind === 'bits');
    const looted = !!success && success.kind === 'bits' &&
        success.bits.some((b) => b.bit === LOOT.SUCCESS_BIT && isC(b.value) && b.value.v === 1);
    const add = ch.find((x) => x.kind === 'add' && !MAILBOX.has(x.addr));
    const flagsSet: LootOutcome['flagsSet'] = [];
    for (const x of ch) {
        if (x.kind !== 'bits' || x.addr === LOOT.SUCCESS) continue;
        for (const b of x.bits) if (isC(b.value) && b.value.v === 1) flagsSet.push({ addr: x.addr, bit: b.bit });
    }
    return {
        item,
        itemName: itemName(item, dec),
        object,
        looted,
        amount: looted && add && add.kind === 'add' ? add.amount : null,
        slot: looted && add ? add.addr : null,
        flagsSet,
    };
}

export function itemName(item: number, dec: Decoder): string {
    if (item === 0) return 'nothing';
    if (item === 1) return 'money';
    return dec.lootRewardName(item) ?? `item 0x${item.toString(16).padStart(4, '0')}`;
}

/** "Thraxx dead", "not $2266&0x80", "(boy == controlled char)". */
export function describeCondition(cond: Sym, value: boolean, dec: Decoder): string {
    let text: string;
    if (cond.k === 'bit' && cond.a.k === 'mem') {
        const name = dec.flagName(cond.a.addr, cond.bit);
        text = name ? `${name} [${key(cond)}]` : key(cond);
    } else if (cond.k === 'bin' && cond.op === '==' && key(cond) === '(boy == controlled char)') {
        return value ? 'the boy is in control' : 'the dog is in control';
    } else {
        text = key(cond).replace(/⟨\d+⟩/g, '');
    }
    return value ? text : `not ${text}`;
}

/** One line per change, in WRAM terms. */
export function describeChange(x: Change, dec: Decoder): string {
    if (x.kind === 'add') return `${ramHex(x.addr)} += ${key(x.amount)}`;
    if (x.kind === 'bits') {
        return x.bits.map((b) => {
            const name = dec.flagName(x.addr, b.bit);
            const shown = name ? `(${name})` : '';
            return `${ramHex(x.addr)}&0x${(1 << b.bit).toString(16).padStart(2, '0')} = ${key(b.value)}${shown ? ' ' + shown : ''}`;
        }).join(', ');
    }
    return `${ramHex(x.addr)} = ${key(x.value)}`;
}

export { c, bin };
