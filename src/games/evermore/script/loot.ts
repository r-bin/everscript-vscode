// Ownership: what a pickup gives, read out of the script that grants it. Pure.
//
// Ported from `LootData` in SoEScriptDumper/list-rooms.cpp.
//
// Pickups do not compute their reward — they *write it down*. A sniff spot, a
// gourd or a chest is a B-trigger script that tests a "already taken" flag,
// writes literal values to four well-known addresses, and calls one of two
// global scripts to do the actual handing-over:
//
//   $2391  LOOT_ITEM             what you get
//   $2395  LOOT_OBJECT           which object in the room this is
//   $2393  LOOT_AMOUNT_CURRENCY  how much money
//   $2461  LOOT_AMOUNT           see below
//   call 0x39                    "loot nature" — sniff spot / kneel animation
//   call 0x3a                    "loot gourd"  — gourd, pot, chest
//
// $2461 means two different things depending on *when* it is written, which
// the everscript encoder's `loot()` makes explicit:
//
//   before the call   amount - 1   (so no write at all means "one of them")
//   after the call    the bonus added to whatever you pick up next
//
// Reading it position-blind, as `LootData` upstream does, loses the amount.
//
// There is nothing to simulate here: the values are constants in the ROM and
// walking past them is enough. That is also why it is checkable — upstream's
// `sniffflags.inc` was *generated* by this same extraction, so the committed
// copy of it is ground truth, and tests/memory/script-loot.test.js
// regenerates all 593 lines of it.

import { DecodedInstruction } from './decoder';
import { lootRewardName } from './names';

/** How the value was encoded, which says whether it can be patched in place. */
export type ValueEncoding = 'word' | 'byte' | 'inline' | 'expression';

export interface LootValue {
    value: number;
    encoding: ValueEncoding;
    /** SNES address of the value's bytes — where a patch would write. */
    at: number;
}

export interface LootFacts {
    /** What the pickup grants, when it is a literal. */
    item: LootValue | null;
    /** The Everscript `LOOT_REWARD` name for that item, when there is one. */
    itemName: string | null;
    /** How many — 1 unless the script says otherwise. */
    amount: number;
    /** Bonus added to whatever the player picks up next. */
    next: number;
    /** Which object in the room this pickup belongs to ($2395). */
    objectId: number | null;
    /** The "already taken" flag the script tests. */
    checkFlag: { addr: number; bit: number } | null;
    /** The flag it sets once taken. */
    setFlag: { addr: number; bit: number } | null;
    /** 'sniff' for global script 0x39, 'gourd' for 0x3a. */
    kind: 'sniff' | 'gourd' | null;
}

/** Below this, an item id is money and the amount is counted differently. */
const MONEY_BELOW = 0x0100;

const LOOT_ITEM = 0x2391;
const LOOT_AMOUNT_CURRENCY = 0x2393;
const LOOT_AMOUNT = 0x2461;
const LOOT_OBJECT = 0x2395;
const CALL_LOOT_NATURE = 0x39;
const CALL_LOOT_GOURD = 0x3a;

export function emptyLoot(): LootFacts {
    return { item: null, itemName: null, amount: 1, next: 0, objectId: null, checkFlag: null, setFlag: null, kind: null };
}

/** True when there is enough here to describe a pickup. */
export function isLoot(facts: LootFacts): boolean {
    return facts.kind !== null && facts.item !== null;
}

/**
 * Fold a decoded script's effects into what it gives.
 *
 * Last write wins, as upstream does: a script may set a placeholder and
 * overwrite it on a branch, and the final value is the one that survives.
 * Nothing here follows branches — this is a linear read of the instruction
 * stream, which is exactly as far as the evidence goes.
 */
export function extractLoot(instructions: readonly DecodedInstruction[]): LootFacts {
    const facts = emptyLoot();
    let called = false;
    let beforeCall: number | null = null;
    let afterCall: number | null = null;
    let currency: number | null = null;

    for (const ins of instructions) {
        for (const e of ins.effects) {
            if (e.kind === 'checkFlag') { facts.checkFlag = { addr: e.addr, bit: e.bit }; continue; }
            if (e.kind === 'setFlag') { facts.setFlag = { addr: e.addr, bit: e.bit }; continue; }
            if (e.kind === 'callGlobal') {
                if (e.id === CALL_LOOT_NATURE) { facts.kind = 'sniff'; called = true; }
                else if (e.id === CALL_LOOT_GOURD) { facts.kind = 'gourd'; called = true; }
                continue;
            }
            if (e.kind !== 'write') continue;
            switch (e.addr) {
                case LOOT_ITEM:
                    facts.item = e.value === null
                        ? null : { value: e.value, encoding: e.valueType, at: e.valuePos };
                    break;
                case LOOT_OBJECT: if (e.value !== null) facts.objectId = e.value; break;
                case LOOT_AMOUNT_CURRENCY: currency = e.value; break;
                case LOOT_AMOUNT:
                    if (called) afterCall = e.value; else beforeCall = e.value;
                    break;
                default: break;
            }
        }
    }

    const isMoney = facts.item !== null && facts.item.value < MONEY_BELOW;
    if (isMoney) facts.amount = currency ?? 0;
    else facts.amount = beforeCall === null ? 1 : beforeCall + 1;
    facts.next = afterCall ?? 0;
    facts.itemName = facts.item === null ? null : lootRewardName(facts.item.value);
    return facts;
}
