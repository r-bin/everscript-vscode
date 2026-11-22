---
addr: $7E:2315
name: ITEM_QTY_PETALS
type: u8
tags: [item, inventory]
lifetime: save
confidence: confirmed
evidence: ["rom: the ring items 71-78 (menus/ring_items: item_petals .. item_call_bead) are the consumables in this order", "disasm: $8E:9298 tests and $8E:9140 decrements the held count at $2315,x by consumable index", "test: the loot script 0x3e increments $2315 + (reward - 0x0800) (ING_QTY_WAX.md, v0.202.0)"]
see: [knowledge/wram/ING_QTY_WAX.md, docs/disassembly/combat/consumable-effects.md]
---
Petals held (consumable 0, cap 6): one byte of the consumable counts at `$2315` + index.

Before v0.459.1 the WRAM map named `$2315`-`$231C` as two ingredients and "satchel slots".
