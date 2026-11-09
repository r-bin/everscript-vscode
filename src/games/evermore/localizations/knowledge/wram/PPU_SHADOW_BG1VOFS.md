---
addr: $7E:0110
name: PPU_SHADOW_BG1VOFS
type: u16
tags: [widescreen, widescreen.scroll]
confidence: verified
evidence: ["cdl", "disasm"]
---
BG1 vertical scroll offset shadow; low byte written to $210E, high byte written to $210E.

## Widescreen notes

Default camera mode writes `$5B - 1` here and to BG2VOFS ($90:9A98). The streamer `$90:98FA` uses `(value + 1) >> 4` as the top metatile row (asm read 2026-11-09).
