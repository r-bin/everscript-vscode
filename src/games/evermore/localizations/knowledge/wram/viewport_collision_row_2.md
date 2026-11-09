---
addr: $7E:093A
name: viewport_collision_row_2
type: u16[16]
tags: [widescreen, widescreen.streaming]
confidence: verified
evidence: ["cdl", "disasm"]
---
Viewport metatile collision row 2 (16 words: local terrain physics geometry).

## Widescreen notes

`$7E:093A..$7E:0979` is the BG2 column staging buffer of the streamer `$90:98FA` (see viewport_collision_row_0). Previously believed: collision row (asm read 2026-11-09).
