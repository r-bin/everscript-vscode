---
addr: 8DC2BF
size: 98
kind: code
category: 🧠
name: options_menu_controller_cursor_icon_draw
title: Renders the button selection cursor sprite in the Options Menu controller configuration screen
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Renders the button selection cursor sprite in the Options Menu controller configuration screen.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Draws the flashing highlight cursor indicating the currently selected controller button in the Options Menu.
The routine indexes controller button configuration table `$7E:22FF,X`, derives on-screen button layout coordinates in `$02` and `$04`, and emits cursor sprite entries into the OAM buffer via `$80:9033` (`direct_sprite_draw_oam`).

## Callers
- `$8D:C233` (`FUN_8dc233`)

## Callees
- `$80:9033` (`direct_sprite_draw_oam`)

## Variables and memory (hypotheses)
- `$7E:22FF` (Player button mapping configuration array)
- `$0D0D`, `$0D17` (Cursor screen position coordinates)
