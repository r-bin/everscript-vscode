---
addr: 8CBAAB
size: 199
kind: code
category: 🧠
name: dialogue_window_border_tilemap_clear
title: Clears dialogue window interior tiles and draws ornamental border and corner tiles in the UI tilemap buffer
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Clears dialogue window interior tiles and draws ornamental border and corner tiles in the UI tilemap buffer.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Prepares the visual frame for dialogue text boxes, menus, and shop windows.
The routine clears the window interior tile area to empty/transparent tiles and writes border pattern indices into the UI tilemap staging memory.

It places corner brackets and edge borders, preparing the window surface for subsequent character rendering.

## Callers
- `$8C:BA86` (`FUN_8cba86`)

## Callees
- `$80:8650` (`FUN_808650`)

## Variables and memory (hypotheses)
- `$22`, `$24` (Pointer to window tilemap buffer)
- `$26` (Window dimensions and coordinate offsets)
- `$2E` (Tile attribute and palette index for window borders)
