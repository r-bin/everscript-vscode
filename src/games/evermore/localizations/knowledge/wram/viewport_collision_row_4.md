---
addr: $7E:097A
name: viewport_collision_row_4
type: u16[16]
tags: [widescreen, widescreen.streaming]
confidence: verified
evidence: ["cdl", "disasm"]
---
Viewport metatile collision row 4 (16 words: local terrain physics geometry).

## Widescreen notes

`$7E:097A..$7E:09B9` is the BG1 row staging buffer of the streamer `$90:98FA` (`room_tilemap_layer2_parallax_offset_calc`, `$2E = $097A`): `$0FAC` cells of the newly exposed metatile row, VMAIN `$80`. Previously believed: collision row (asm read 2026-11-09).
