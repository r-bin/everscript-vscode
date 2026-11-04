---
addr: 7E246B
size: 2
kind: var
name: INTRO_CREDITS_LINE_MODE
title: Title and credits sequence text line layout mode flag
lifetime: room
confidence: confirmed
tags: [intro, credits, text, layout]
evidence: ["disasm: func_80C6D2, func_80C763, and func_80C881 test $7E:246B; when 0, updates 3 text lines ($681D, $682D, $683D); when non-zero, skips line 3 and renders 2 lines"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-bit layout mode flag controlling multi-line text positioning during opening sequence and end credits sequences:
- `0`: 3-line text mode — renders and bounces lines at `$681D`, `$682D`, and `$683D`.
- Non-zero (`1`): 2-line text mode — skips line 3 (`$683D`) and adjusts line 1 & 2 vertical offsets.
