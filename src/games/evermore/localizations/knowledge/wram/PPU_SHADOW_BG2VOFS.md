---
addr: $7E:0114
name: PPU_SHADOW_BG2VOFS
type: u16
tags: [widescreen, widescreen.scroll]
confidence: verified
evidence: ["cdl", "disasm"]
---
BG2 vertical scroll offset shadow; low byte written to $2110, high byte written to $2110.

## Widescreen notes

`$5B - 1` in the default camera mode ($90:9A98) (asm read 2026-11-09).
