---
addr: C45CC7
end: C45D08
size: 66
kind: table
category: 📋
name: tbl_C45CC7
title: Ingredient icons — a long pointer per ingredient
confidence: confirmed
tags: ["table","alchemy","ingredients","icon"]
evidence: ["CDL recorded table: 22 entries × 3B (out/recomp/asar/tables/tables.json)", "disasm: each reader is `lda.l $C45CC7,x` / `lda.l $C45CC8,x` with X = 3·ingredient into $26-$28, then $80:9033 draws it (2026-11-23)", "test: a grown Open Evermore build moves the table and the new ingredient shows the icon it copies, in game (docs/todo/growable-items.md)"]
see: [docs/todo/growable-items.md]
---

Ingredient `k`'s icon: 3 bytes at `3·k`, a long pointer into bank `$CC`. Drawn on the alchemy screen's ingredients page and the formula cards' costs (the five reader pairs below). Open Evermore moves it when ingredients are added (`codecs/ingredients.mts`).

CDL lookup table at $C4:5CC7 (66 bytes, 22 entries × 3B). Index: tbl_alchemy_cost_data..$C460A7 (31) > and #$00FF > asl > adc $7E0012 > tax. Result: sta $7E0026. Read by ring_menu_item_icon_graphic_and_palette+$1C (8D:BE5E), ring_menu_item_icon_graphic_and_palette+$57 (8D:BE99), options_menu_stereo_mono_audio_toggle+$1F (8D:C8A6), options_menu_stereo_mono_audio_toggle+$55 (8D:C8DC), options_menu_controller_cursor_icon_draw+$48 (8D:C307), ring_menu_item_icon_graphic_and_palette+$22 (8D:BE64), ring_menu_item_icon_graphic_and_palette+$5D (8D:BE9F), options_menu_stereo_mono_audio_toggle+$25 (8D:C8AC), options_menu_stereo_mono_audio_toggle+$5B (8D:C8E2), options_menu_controller_cursor_icon_draw+$4E (8D:C30D).
