---
addr: 909BA7
end: 909BFE
size: 88
kind: code
category: 🧠
name: room_tilemap_bg1_h_scroll_matrix_stream
title: Streams horizontal background scrolling offsets into PPU register $211B for scanline parallax effects
confidence: likely
tags: [unverified, rea-partial-read, widescreen, widescreen.parallax]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Streams horizontal background scrolling offsets into PPU register $211B for scanline parallax effects.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Applies horizontal raster wave distortion and parallax effects to Background 1.
The routine calculates camera displacement deltas (`$59` minus offset `$7E:2417`), scales the result, and writes high and low bytes to PPU matrix register `$211B` across scanlines to produce heat shimmer or water surface wavering.

## Callers
- `$90:9B75` (`FUN_909b75`)

## Callees
- None

## Variables and memory (hypotheses)
- `$59` (Camera horizontal world position)
- `$7E:2417` (Parallax reference coordinate)
- `$211B` (SNES PPU Mode 7 / Matrix Parameter register)

## Widescreen notes

Read whole (2026-11-09): parallax position for camera modes 1/3: x = (((`$59` − `$2417`) x 16 + `$0F38`) x `$22FA`) >> 8 + `$241B` (and the same for y with `$5B`, `$2419`, `$22FB`, `$241D`, − 1), computed with the Mode 7 multiplier (`$211B`/`$211C` → `$2135`). `$22FA` = ratio in 1/16. Not a scanline HDMA stream.
