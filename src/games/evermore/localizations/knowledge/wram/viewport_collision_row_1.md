---
addr: $7E:091A
name: viewport_collision_row_1
type: u16[16]
tags: [widescreen, widescreen.streaming]
confidence: verified
evidence: ["cdl", "disasm"]
---
Viewport metatile collision row 1 (16 words: local terrain physics geometry).

## Widescreen notes

Second half of the BG1 column staging buffer `$7E:08FA..$7E:0939` (see viewport_collision_row_0). Previously believed: collision row (asm read 2026-11-09).
