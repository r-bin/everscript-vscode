---
addr: 8E8144
size: 1296
end: 8E8653
kind: table
category: 📋
name: RING_ITEMS
title: Ring items: name, icon, palette, index (8 bytes each)
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: ring loops print +0 as a $C4 string ($8C:9E03 with $24=#$C4), $8E:AEBC streams +2 (animation record) and allocates +4 (palette); dispatches read +6"]
see: ["docs/open-evermore/resources.md"]
---
The 162 ring items, 8 bytes each: `+0` name, a 16-bit offset of a plain NUL-terminated ASCII string in bank `$C4` (the same strings the weapon records `$C4:3874`, the formula names `$C4:5D09` and the ingredient names `$C4:6001` point at); `+2` icon, an animation record in bank `$C4`; `+4` palette, 16 colours in bank `$D0`; `+6` index: what the ring that shows the item does with it (weapon number, formula number, consumable number, armour number ×2, or the entry of an action table: `RING_OPTION_ACTIONS`, `ITEM_RING_ACTIONS`, `CALL_BEAD_CALLER_ACTIONS`, `CALL_BEAD_SPELL_ACTIONS`). Ids `$00`-`$14` are debug options, `$16`-`$26` the options rings' items, `$F0`-`$F6` the four Call Bead callers and `$F8`-`$116` their 16 spells. Open Evermore: `menus/ring_items/`.

Previously believed: ids `$F8`-`$116` are 16 alchemy formulas the game never grants.

Previously believed: "Ring-menu icon entries ($8E:8144)" (asset_8e8144_ring_menu_icon_entries).
