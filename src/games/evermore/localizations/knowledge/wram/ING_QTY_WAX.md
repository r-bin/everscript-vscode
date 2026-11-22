---
addr: 7E22FF
end: 7E2344
kind: table
name: ING_QTY_WAX
title: Inventory counts — ingredients, consumables, armor
lifetime: save
confidence: confirmed
tags: [inventory, loot]
evidence: ["test: derived by simulating global 0x3e ($92:A584) once per LOOT_REWARD id and reading which byte it increments (src/games/evermore/simulation, v0.202.0)", "test: 910/910 item pickups in the ROM increment the byte this table names"]
see: [routines/loot_count_in.md]
---
One byte per item, written only by the loot script `0x3e` (and shops). Caps are the
`count + bonus < cap` tests in that script.

| bytes | items | cap |
|---|---|---|
| `$22FF`–`$2314` | ingredients `0x0200`–`0x0215` in order (Wax `$22FF`, Water `$2300`, Vinegar, Roots, Oil `$2303`, …, Crystal `$230E`, Clay, Brimstone, Bone, Atlas Medallion, Ash `$2313`, Acorns `$2314`) | 99 |
| `$2304` / `$2305` | **exception**: Mushroom (`0x0206`) is `$2304`, Mud Pepper (`0x0205`) is `$2305` | 99 / **1** |
| `$2315`–`$231B` | consumables `0x0800`–`0x0806` (Petal, Nectar, Honey, Biscuit `$2318`, Wings, Herbal Essence, Pixie Dust) | 6 |
| `$231C` | Call Beads (`0x0807`) | the byte at `$234A` |
| `$231D`–`$2344` | armor `0x0401`–`0x0428` in order (chests, helms, gloves, collars) | 6 |

Each byte has its own entry (`ING_QTY_*`, `ITEM_QTY_*`, `ARMOR_QTY_*`); the WRAM map had `$2309`-`$231C` one cell off
until v0.459.1 (it dropped Gunpowder at `$2309`, invented "Root Extra" at `$2314` and called the consumables satchel slots).

**Not the currencies.** An earlier entry called `$2309`-`$2314` the four 24-bit currency balances. They are the purses
at `$0AC6` (talons), `$0AC9` (jewels), `$0ACC` (gold coins) and `$0ACF` (credits): the currency opcodes `0x0A`, `0x7C`,
`0x7D`, `0x7E` index them by the offset 0/3/6/9, and so does the kill-money award `$8F:8689`.
