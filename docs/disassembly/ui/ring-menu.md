# Ring menus

How the rings work, from the code (v0.455.0). Each address has its knowledge entry; Open Evermore explodes all of it as
`menus/` ([resources.md §menus](../../open-evermore/resources.md)).

## Ring items

`RING_ITEM_POINTERS` (`$8E:8000`, 162 words, ring item id = 2·n) → `RING_ITEMS`, 8 bytes each (`$8E:8144`-`$8653`):

| Offset | Size | Field |
|---|---|---|
| `+0` | 2 | name: offset of a plain NUL-terminated ASCII string in bank `$C4` (shared with weapon records `$C4:3874`, formula names `$C4:5D09`, ingredient names `$C4:6001`) |
| `+2` | 2 | icon: an animation record in bank `$C4` (`$8E:AEBC` streams it) |
| `+4` | 2 | palette: 16 colours in bank `$D0` |
| `+6` | 2 | index: read by the ring that shows the item (an action table's entry, or a weapon, formula, consumable, armour or ingredient number) |

Ids: `$00`-`$14` debug, `$16`-`$26` options, `$28`-`$40` weapons, `$42`-`$46` bazooka ammo, `$48`-`$8C` formulas,
`$8E`-`$9E` consumables and Pouch, `$A0`-`$EE` armour, `$F0`-`$F6` the Call Bead callers, `$F8`-`$116` their spells,
`$118`-`$142` ingredients (docs/item-icons.md draws them).

## Rings and flows

A ring is an id (2·n, 18 of them) into three tables: `RING_BUFFERS` `$8E:9920` (a WRAM buffer: `+0` count, `+2`
cursor, `+4` up to 16 ring item ids), `RING_LOOPS` `$8E:9944` (the loop run while it is open) and `RING_FLAGS`
`$8E:9968` (copied to `$05AB`). A flow (`RING_FLOWS`, `$8E:998C`) is a count and that many ring ids: what Up/Down cycles
through. Y asks for the Boy's flow (`$8F:CDDD` sets `$05A9` bit 1), X for the Dog's (bit 2); `$8E:E508` opens it
through `$8E:A091` → `$8E:A0B3`, which skips rings whose count is 0.

Each loop prints the selected item's name (`$8C:9E03` with bank `$C4`), waits for a button (`$8E:ADBC`) and on confirm
(B) does what the item's index says: `RING_OPTION_ACTIONS` `$8E:A444`, `ITEM_RING_ACTIONS` `$8E:A873`,
`ALCHEMY_RING_ACTIONS` `$8E:A777`, `CALL_BEAD_CALLER_ACTIONS` `$8E:99CA`, `CALL_BEAD_SPELL_ACTIONS` `$8E:AD43`.

## Builders

Before a ring opens its buffer is filled: the options rings by `lda #imm : sta` (`init_equipment_screen_slots`
`$8E:9A86`), weapons from the weapon records (`calc_equipped_armor_defense` `$8E:99D2`, a misnomer kept for the C),
alchemy from the formulas put on the ring through `$C4:5BAF` (`ring_alchemy_build`), items through `$C4:5AAE`
(`ring_items_build`), armour through `$C4:5ABE` (`ring_menu_inventory_item_availability_filter`), the Call Bead rings by
immediates (`call_bead_callers`, `call_bead_*_spells`), bazooka ammo (`ring_bazooka_ammo_build`).

Previously this page described a descriptor with the name in bank `$8E` and four categories; both were wrong.

> **Reconstructed C:** [`reconstructed-c/8E/8E8000_ring_menu.c`](../../../reconstructed-c/8E/8E8000_ring_menu.c).
