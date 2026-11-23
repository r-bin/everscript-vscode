# Growable items (Open Evermore)

New ingredients, consumables and named items (charms, key items), and then new ingredients as formula costs and
loot. The owner's order (2026-11-23): ingredients end to end first, then consumables, then named items. New ids keep
their state in `temp[]` cells (the owner's choice, 2026-11-23: no change to the save format yet). Kinds and files:
[../open-evermore/resources.md](../open-evermore/resources.md) §menus, §alchemy; WRAM: [wram-allocation.md](wram-allocation.md);
roadmap step 8 ([../open-evermore/roadmap.md](../open-evermore/roadmap.md)). Addresses below are US.

## What holds each list at its vanilla size (found 2026-11-23)

### The save file is six blocks, not `$2258`-`$2833`

A save slot is `$331` bytes at `$30:6002 + slot·$331` (the four bases at `$C4:599A`). The writer (`$8D:B323`-`$B46F`, in
`save_menu_sram_slot_checksum_and_validator`) and the loader (`$8D:B648`-`$B7D5`) DMA these WRAM blocks, then checksum
`$32F` bytes (`$8D:B478`):

| slot offset | WRAM | bytes | what |
|---|---|---|---|
| `+$000` | (party records) | `$F0` | stats copied from `$4FDB`… (not traced here) |
| `+$0F0` | `$0ABA`-`$0B1E` | `$65` | equipped armour, purses, weapon skill words |
| `+$155` | `$2F52`-`$2FF3` | `$A2` | formula experience (`$2F52`) and levels (`$2F98`), then 22 bytes of the cast words (`$2FDE`) |
| `+$1F7` | `$2258`-`$22E9` | `$92` | learned formulas, story flags, charms |
| `+$289` | `$22FF`-`$235A` | `$5C` | ingredient, consumable and armour counts, ammo |
| `+$2E5` | `$2361`-`$238C` | `$2C` | |
| `+$311` | `$2513`-`$2532` | `$20` | |

So `$22EA`-`$22FE`, `$235B`-`$2360`, `$238D`-`$2512` and `$2533`-`$2833` are **not saved**: they survive room loads,
not a reload. `$2559`-`$2833` (731 bytes) no code and no script touches (CDL library, 2026-11-23). Growing the save
(longer blocks, a larger slot stride, the checksum window) is a later step, not taken now.

### Ingredients (22)

Lifted in v0.460.0 as steps I1-I6 say (resources.md §alchemy, "Adding an ingredient"); the shop's ring item is left (I7).

| What | Where | Why it stops at 22 | To lift |
|---|---|---|---|
| held count | `$22FF + id`, a byte; consumables follow at `$2315` | no byte for id 22 | new ids: a `temp[]` cell each (file `held: "temp[99]"`), the readers below redirected |
| name | `$C4:5FF3`, 22 words (16-bit, bank `#$C4` set by every printer), the cost table right after | packed table; `$C4` has no free byte | move the table (its readers are `lda.l`); room for names in `$C4` from tables that leave the bank (roadmap step 3) |
| cost | `$C4:601F`, 4 bytes a formula (ingredient, ingredient, count, count) | none: an ingredient is a byte | — |
| cast check and use | `$91:CDF1`/`CDF8`, `CE1E`/`CE25` (`lda.l`/`sta.l $7E22FF,x`, 16-bit: the next ingredient's byte is read and written back), `CE4C`, `CE70` (8-bit, casts left) | `$22FF,x` | a hook per site (`jsl`, same length) that reads the id's cell |
| alchemy screen list | `$8D:C1AA` and `$8D:C2CB` (`ldx #$0015`, down to 0), screen positions through `$8D:C22B` (4 words; the layout is not read fully) | 22 rows on a fixed layout | the loop bound generated; where a 23rd row goes: **not checked in game** |
| shop | `$8E:8DC9`/`8DDF` (`lda`/`sta $22FF,x`, 8-bit, 3 bytes: buy) and `$8E:A923` (the held count the ring shows) | `$22FF,x` by the ring item's index | a hook (`$8E:8DC5`-`8DCB` is 7 bytes: room for a `jsl`) |
| ring item | ids `$118`-`$142` of the 162 (`menus/ring_items`), entries in bank `$8E` | 162 pointers, code after | only needed for shops; a new ingredient can do without one at first |
| loot | `global_loot_part1/2/3` (one branch per reward id: count in, "got" text, full text), reward ids `$0200`-`$0215` | none: scripts | a branch per new reward id in each, writing the `temp[]` cell (the scripts kind edits them today) |
| text opcode | `$8C:EDF3` prints `$2258 + n` as a number (dialogue) | none | — |
| new game | `$8C:D816` clears the counts | `temp[]` is cleared anyway | — |

### Consumables (8, plus the Pouch) — lifted in v0.461.0 (resources.md §items)

Counts `$2315 + i` (armour follows at `$231D`), ring items `$8E`-`$9C`, the action table `$8E:A873` (9 words, code from
`$8E:A885`, `JSR ($A873,x)`: the table must stay in bank `$8E`). Readers of the counts: `$8E:8CDC`, `8E98`, `914D`,
`9B96`, `9C77`, `A817`, `A9F2`, `AB71`; Call Beads also `$91:A787`, `$91:ADC3`. What a use does is data: `item_use_on_target` (`$8E:8CA7`) reads the target `$C4:5A84`, the block `$C4:5A92` and the power `$C4:5AA0`.

### Named items (20) — lifted in v0.461.0 (resources.md §items)

One list for charms and key items, shown by `$8C:C0E9` (in `pause_menu_sound_and_options_window`), entry `k` = `2·k`:

| Table | What |
|---|---|
| `$8C:BBB0` | the WRAM word holding the flag (`$2261`-`$2264`) |
| `$8C:BBD8` | its bit mask |
| `$8C:BC1A` | the name, 16 bits in bank `$C4` (the loop sets `#$C4` itself, `$8C:C124`) |

Entries 0-13 are the charms (Armor Polish … Wizard's Coin, `$2261` bit 5 to `$2263` bit 2), 14-19 key items (`$2264`
bits 0-5). Bound `cmp #$0026` at `$8C:C148`; where each row goes by `$0D0D` (positions `$8C:C168`; not read fully). Other readers of the
two flag tables: `$8F:9215` (equip sync, by `$243D`), `$8C:C403` (count), `$8C:C345`, `$8C:C39B`. A new named item needs
only a flag bit, and saved bits are left (candidates: `$22DB` bits 6, 7; `$225C` bits 3-6, after the 35 learned bits; bit 7 is a Call Bead caller's): **no `temp[]` needed**. What a
charm does is code reading its bit; a new one is a key item that scripts set and test.

## Steps

| # | Step | State |
|---|---|---|
| I1 | Ingredients kind growable in the files: a new file is a new id, `held` a `temp[]` cell, `text` its name, `icon` a vanilla one's | ✅ v0.460.0 (`codecs/ingredients.mts`) |
| I2 | Names: the one reader (`$8D:C1F6`) and its bank immediate (`$8D:C1F3`) point at a generated table + strings in any bank, so `$C4` needs no room | ✅ v0.460.0 |
| I3 | Count hooks: every reader above reads a new id's cell (generated code, only when the kind has grown; vanilla bytes otherwise) | ✅ v0.460.0: unit test on the 65816 interpreter; cast and alchemy screen in game |
| I4 | Alchemy screen: the list's bounds generated, the icon table moved | ✅ v0.460.0: a held new ingredient is listed (two columns of held ones; 23 held at once not tried) |
| I5 | Formula cost by a new ingredient (cost/`ingredient` accepts ids past 21) | ✅ v0.460.0: Cure costing Salt, cast in game |
| I6 | Loot: the three loot scripts' branches by hand (resources.md §alchemy), a gourd and a ground pickup proven in game | 🟩 v0.461.0: a real gourd gives Salt in game, "Found some Salt"; `PRIZE` takes new items by name (`salt`). A sniff spot runs the same scripts (not seen). Open: the branches are hand-written per item |
| I7 | Shop: a ring item for the ingredient (ring items growable, bank `$8E`) | 🔴 |
| C1 | Consumables: as I1-I7, plus the action table (bank `$8E`) and the use effect | 🟩 v0.461.0 (`items.mts`, `consumable-hooks.mts`): a new one on a `debug_*` ring item, `temp[]` count, target/block/power; seen in game (ring, use, heal by its power). Open: shops (`$C4:5ABE`), loot branches |
| N1 | Named items kind: 20 entries `{ name, flag }` (flag by name, `CHARM_FLAGS` bit), in place | 🟩 v0.461.0 (with `description`) |
| N2 | Named items growable: the three tables moved, the bound generated, names in `$C4` (I2) or in a bank of their own (the loop's `#$C4`) | 🟩 v0.461.0: four tables, icons and strings in one generated item, both bank immediates, four loop bounds; seen in game. Open: more than 20 held at once (the list has 20 places) |
