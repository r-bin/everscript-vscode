---
addr: $7E:0F90
name: MINIMAP_RADAR_WINDOW_LEFT
type: u16
tags: [widescreen, widescreen.streaming]
confidence: verified
evidence: ["cdl", "disasm"]
---
Minimap radar viewport left horizontal clipping bound ($90:A4EC).

## Widescreen notes

Not a minimap: the left metatile column of the streamed BG1 window, `BG1HOFS >> 4`, kept to detect a column change (`$90:98FA` subtracts it to get the scroll delta in `$0A`). Previously believed: minimap radar window (asm read 2026-11-09).
