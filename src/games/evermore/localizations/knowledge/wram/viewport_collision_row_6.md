---
addr: $7E:09BA
name: viewport_collision_row_6
type: u16[16]
tags: [widescreen, widescreen.streaming]
confidence: verified
evidence: ["cdl", "disasm"]
---
Viewport metatile collision row 6 (16 words: local terrain physics geometry).

## Widescreen notes

`$7E:09BA..$7E:09F9` is the BG2 row staging buffer of the streamer `$90:98FA` (see viewport_collision_row_4). Previously believed: collision row (asm read 2026-11-09).
