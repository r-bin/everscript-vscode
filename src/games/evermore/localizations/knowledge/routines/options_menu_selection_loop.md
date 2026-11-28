---
addr: 8DC803
size: 102
end: 8DC868
kind: code
category: 🎛️
name: options_menu_selection_loop
title: Game options menu interactive selection loop
confidence: likely
tags: [options, settings, input, ui, menu]
evidence: ["disasm: called from $8E:95A6 (ring_option_alchemy); DMA-enqueues cursor sprites $AA4B/$A98B via $90:CFB8; polls input via $80:8597; delegates window redraw to $8D:BF71 (options_menu_window_formatter); handles setting modification via $8D:C887 (REA dossier 0x8dc803)"]
---
Interactive navigation loop for the game options menu, cycling between audio output mode (stereo/mono), button mappings, target cursor styles, and window frame borders.

## Correction (2026-11-28)
Called after `$8D:C321` by `ring_option_alchemy`, it is the loop of the **Alchemy Formulas / Ingredients** screen
(L and R switch pages; run in MesenCE), not of a game options menu.
