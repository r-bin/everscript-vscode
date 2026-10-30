---
addr: 8EACEC
size: 87
kind: code
category: 🧠
name: shopkeeper_dialogue_show_confirm_sell_box
title: Displays the confirmation prompt window for selling items or equipment in shops, showing the payout amount
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Displays the confirmation prompt window for selling items or equipment in shops, showing the payout amount.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Builds the sell confirmation prompt when offering an item to a merchant.
The routine closes active menus via `$8E:AE85`, clears the dialogue window tilemap via `$8C:AF2B`, reads the item\'s sell-back value from ROM table `$8E:8000,X`, formats the dialogue string via `$8C:9E03`, and waits for user confirmation via `$8E:ADBC`.

## Callers
- Shop sell transaction loops in Bank `$8E`

## Callees
- `$8C:9E03` (`dialogue_format_and_append_line`)
- `$8C:AF2B` (`window_tilemap_buffer_init`)
- `$8E:ADBC` (`func_8EADBC`)
- `$8E:AE85` (`ring_menu_close_and_restore_screen`)

## Variables and memory (hypotheses)
- `$95` (Selected shop sell item descriptor pointer)
- `$8E:8000` (ROM item sell value lookup table)
