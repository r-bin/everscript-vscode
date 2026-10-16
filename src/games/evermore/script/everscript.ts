// Ownership: writing decoded facts back out as Everscript source. Pure.
//
// The point of this file is the round trip. `everscript`'s compiler turns
// `_loot(0x16, MUSHROOM, 0d1, 0d4)` into the bytes this repo decodes; going
// the other way means a vanilla pickup can be read, edited and recompiled
// instead of patched by hand.
//
// It only emits what it can emit *exactly*. A pickup whose reward is computed
// rather than written down has no `_loot(...)` form, and this returns null
// rather than a near-miss that would compile into something else. Everything
// here is scored against the encoder's own signature in
// `compiler/ast_everscript.py`:
//
//   _loot(object, reward, amount, next)         kneel animation — sniff spots
//   _loot_chest(object, reward, amount, next)   gourds, pots, chests
//
// with `amount` and `next` defaulting to 0 in `_loot_chest`, which is why
// trailing defaults are dropped from the output.

import { LootFacts } from './loot';

/** `0d04` — the encoder's decimal literal. */
function dec(n: number): string {
    return '0d' + String(n).padStart(2, '0');
}

/** `0x1f` */
function hex(n: number): string {
    return '0x' + (n >>> 0).toString(16).padStart(2, '0');
}

/**
 * A pickup as an `_loot` / `_loot_chest` call, or null when it cannot be
 * written exactly.
 *
 * The flag is deliberately absent: the encoder allocates it, so pinning the
 * vanilla address here would fight it. The decoded flag is still reported
 * alongside — it is what identifies the pickup, not what defines it.
 */
export function lootToEverscript(facts: LootFacts): string | null {
    if (!facts.kind || !facts.item || facts.objectId === null) return null;
    const reward = facts.itemName;
    if (!reward) return null;

    const fn = facts.kind === 'sniff' ? '_loot' : '_loot_chest';
    const args = [hex(facts.objectId), reward, dec(facts.amount), dec(facts.next)];
    // `_loot_chest` defaults both tail arguments to zero; `_loot` requires
    // all four.
    if (fn === '_loot_chest') {
        while (args.length > 3 && args[args.length - 1] === dec(0)) args.pop();
    }
    return `${fn}(${args.join(', ')});`;
}
