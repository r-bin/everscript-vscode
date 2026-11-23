---
addr: C45AA0
end: C45ABF
size: 32
kind: table
category: 🧪
name: tbl_consumable_items
title: Consumables — the power of each, then the ring item of each
confidence: confirmed
evidence: ["disasm: item_use_on_target ($8E:8CE8) lda.l $C45AA0,x → the effect's +$2A; ring_items_build ($8E:9BA3) lda.l $C45AAE,x → the ring buffer (2026-11-23)", "rom: power 40 / 120 / 300 for Petals, Nectar, Honey, 0 for the other four; ring items $8E-$9C"]
see: [routines/item_use_on_target.md, routines/ring_items_build.md, docs/item-icons.md]
---
Two tables, consumable `id` at `2·id`:
- `$C4:5AA0`, 7 words: the power the effect gets (Petals heal 40, Nectar 120, Honey 300; the Dog Biscuit, Wings, Essence
  and Pixie Dust have 0: their block does it alone).
- `$C4:5AAE`, 8 words: the ring item the items ring shows (2·ring item id, `$008E`-`$009C`; the Call Bead's is the 8th),
  also read by the shop catalogs (`$8E:9C09`, `$8E:9C83`).

Previously: 8 power words with 100 HP for the Biscuit; the ROM has 7, the Biscuit's 0.
