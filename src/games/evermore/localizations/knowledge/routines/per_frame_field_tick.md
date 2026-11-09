---
addr: 8EE41E
size: 157
end: 8EE4BA
kind: code
category: 🧠
name: per_frame_field_tick
title: Per-frame field tick
confidence: likely
tags: [entity, map, widescreen, widescreen.gate]
evidence: ["disasm: as recorded in the legacy list (functions.ts); details in the body"]
---
Bumps the 32-bit frame counter $0B19, runs the per-frame subsystems, then map effects ($90:9839) and the entity draw pass ($8F:C61E); 7 callers (static: REA/Ghidra spike v0.201.7, likely)

## Widescreen notes

Liveness candidate for the widescreen gate: runs once per field frame, also while dialogue is open (dialogue routines call it) and in Mode 7 flight, so on its own it proves 'field is drawn', not 'player in control' (asm read 2026-11-09).
