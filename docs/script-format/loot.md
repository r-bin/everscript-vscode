# Loot: what a pickup gives

> Status: **solved and fully validated.** `src/script/loot.ts`.

## No simulation needed

Pickups do not compute their reward — they **write it down**. A sniff spot,
gourd or chest is a B-trigger that tests an "already taken" flag, writes
literal values, and calls a global script to hand the item over.

| Address | Everscript | Meaning |
|---|---|---|
| `$2391` | `LOOT_ITEM` | what you get |
| `$2395` | `LOOT_OBJECT` | which object in the room |
| `$2393` | `LOOT_AMOUNT_CURRENCY` | how much money |
| `$2461` | `LOOT_AMOUNT` | **amount − 1** before the call, **bonus for the next pickup** after it |
| `call 0x39` | | "loot nature" — sniff spot |
| `call 0x3a` | | "loot gourd" — gourd, pot, chest |

That `$2461` row is the subtle one, and it came from the encoder's `loot()`
rather than from guessing. Reading it position-blind — as the reference's
own `LootData` does — loses the amount.

**All 922 pickups in the ROM write a literal item.** Not one computes it, so
reading the bytes tells us everything running the game would.

## How it is validated

Upstream's `sniffflags.inc` was itself *generated* by the reference's loot
extraction, which makes it a complete, independently produced record of
every sniff spot. `tests/memory/script-loot.test.js` regenerates it: **593
of 593 lines byte-identical, in both directions** — nothing missing, nothing
invented.

## Round trip

**921 of 922** render back as Everscript the compiler accepts, using its own
`LOOT_REWARD` names:

```
_loot(0x16, MUSHROOM, 0d01, 0d04);
_loot_chest(0x02, WAX, 0d01);
```

The flag is deliberately absent — the encoder allocates it. A pickup whose
reward has no `LOOT_REWARD` name emits nothing rather than a near-miss that
would compile to a different item.
