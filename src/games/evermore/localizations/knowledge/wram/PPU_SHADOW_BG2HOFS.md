---
addr: $7E:0112
name: PPU_SHADOW_BG2HOFS
type: u16
tags: [widescreen, widescreen.scroll]
confidence: verified
evidence: ["cdl", "disasm"]
---
BG2 horizontal scroll offset shadow; low byte written to $210F, high byte written to $210F.

## Widescreen notes

Same value as BG1HOFS in the default camera mode ($90:9A98 writes `$59` to both). The streamer `$90:98FA` reads it for the BG2 window (asm read 2026-11-09).
