// Ownership: what a pickup script gives, read per path from what it stages before calling a
// loot driver. Pure.
//
// The game's rules (knowledge ram/7e2391, ram/7e2461, rom/92a482, rom/92a584): a pickup writes
// the loot mailbox — $2391 the reward id, $2393 the money amount, $2395 the room object — and
// $2461 = amount − 1, then calls global 0x39 (sniff spot), 0x3a or 0x3b (gourd / chest). The
// driver counts in 1 + $2461 and writes $2461 = 0. A $2461 written after the call is a bonus for
// the next pickup. The trigger tests a "taken" flag before and copies the driver's result
// ($22EA bit 0) into it after.

import type { Expression } from '../script-vm';
import type { Step } from './paths';
import { lootRewardName } from './names';

export type ValueEncoding = 'word' | 'byte' | 'inline' | 'expression';

export interface LootValue {
    value: number;
    encoding: ValueEncoding;
    /** Bus address of the value's bytes: where a patch writes. */
    at: number;
}

export interface LootFacts {
    /** The reward id, when the script writes a constant. */
    item: LootValue | null;
    /** The compiler's LOOT_REWARD name for it. */
    itemName: string | null;
    /** How many: 1 + the staged $2461, or the money amount ($2393). */
    amount: number;
    /** A bonus staged after the call, for the next pickup. */
    next: number;
    /** The room object ($2395). */
    objectId: number | null;
    /** The "taken" flag tested before. */
    checkFlag: { addr: number; bit: number } | null;
    /** The flag written after. */
    setFlag: { addr: number; bit: number } | null;
    kind: 'sniff' | 'gourd' | null;
    /** The driver call. */
    at: number;
}

const ITEM = 0x2391;
const MONEY = 0x2393;
const OBJECT = 0x2395;
const BONUS = 0x2461;
const MONEY_ITEM = 1;
const DRIVERS: Record<number, LootFacts['kind']> = { 0x39: 'sniff', 0x3a: 'gourd', 0x3b: 'gourd' };
/** The cells a pickup stages: not room state. */
export const LOOT_CELLS = new Set([ITEM, ITEM + 1, MONEY, MONEY + 1, OBJECT, OBJECT + 1, BONUS, BONUS + 1]);

function encoded(e: Expression | null, at: number, value: number): LootValue {
    if (!e) return { value, encoding: 'word', at };
    const first = e.terms[0];
    if (e.terms.length === 1 && first.subOp === 0x04) return { value, encoding: 'word', at: e.address + 1 };
    if (e.terms.length === 1 && first.subOp === 0x02) return { value, encoding: 'byte', at: e.address + 1 };
    if (e.terms.length === 1 && first.spec.kind === 'const' && first.spec.size === 0) return { value, encoding: 'inline', at: e.address };
    return { value, encoding: 'expression', at: e.address };
}

/** The save-area flag a branch tests, when its condition reads exactly one. */
function testedFlag(e: Expression): { addr: number; bit: number } | null {
    const flags = e.terms.filter((x) => x.subOp === 0x05 && x.value !== undefined);
    if (flags.length !== 1) return null;
    const v = flags[0].value!;
    return { addr: 0x2258 + (v >> 3), bit: v & 7 };
}

/** Every pickup the paths reach, once per driver call and staged values. */
export function lootOf(paths: Step[][]): LootFacts[] {
    const out = new Map<string, LootFacts>();
    for (const path of paths) {
        let item: LootValue | null = null;
        let money: number | null = null;
        let object: number | null = null;
        let bonus = 0;
        let check: LootFacts['checkFlag'] = null;
        let last: LootFacts | null = null;
        for (const { ins, fact } of path) {
            if ((ins.opcode === 0x08 || ins.opcode === 0x09) && ins.operands[0].k === 'E') {
                const f = testedFlag(ins.operands[0].expr);
                if (f) check = f;
            }
            if (fact.k === 'write' && fact.area === 'save') {
                const v = fact.value;
                if (fact.addr === ITEM) item = v === null ? null : encoded(fact.expr, ins.address + 3, v);
                else if (fact.addr === MONEY) money = v;
                else if (fact.addr === OBJECT) object = v;
                else if (fact.addr === BONUS) { if (last) last.next = v ?? 0; else bonus = v ?? 0; }
            }
            if (fact.k === 'flag' && fact.area === 'save' && last && !last.setFlag) last.setFlag = { addr: fact.addr, bit: 31 - Math.clz32(fact.mask) };
            if (fact.k === 'call' && fact.global !== null && DRIVERS[fact.global] !== undefined) {
                const amount = item && item.value === MONEY_ITEM && money !== null ? money : 1 + bonus;
                const loot: LootFacts = {
                    item, itemName: item ? lootRewardName(item.value) : null, amount, next: 0, objectId: object,
                    checkFlag: check, setFlag: null, kind: DRIVERS[fact.global], at: ins.address,
                };
                const key = `${ins.address}:${item?.value}:${amount}:${object}`;
                last = out.get(key) ?? loot;
                if (!out.has(key)) out.set(key, loot);
                bonus = 0;
            }
        }
    }
    return [...out.values()];
}

const dec = (n: number): string => '0d' + String(n).padStart(2, '0');
const hex = (n: number): string => '0x' + (n >>> 0).toString(16).padStart(2, '0');

/**
 * The pickup as the compiler's `_loot(object, reward, amount, next)` (sniff spots, with the kneel)
 * or `_loot_chest(object, reward[, amount[, next]])` (gourds, chests; the tail defaults to 0),
 * from `everscript/compiler/ast_everscript.py` `Loot`. Null when it cannot be written exactly: a
 * computed reward or one without a LOOT_REWARD name. The flag is left out: the compiler allocates it.
 */
export function lootToEverscript(l: LootFacts): string | null {
    if (!l.kind || !l.item || l.objectId === null || !l.itemName) return null;
    const fn = l.kind === 'sniff' ? '_loot' : '_loot_chest';
    const args = [hex(l.objectId), l.itemName, dec(l.amount), dec(l.next)];
    if (fn === '_loot_chest') while (args.length > 3 && args[args.length - 1] === dec(0)) args.pop();
    return `${fn}(${args.join(', ')});`;
}
