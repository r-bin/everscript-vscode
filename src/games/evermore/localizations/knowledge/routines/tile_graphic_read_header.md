---
addr: 8CC8A9
size: 279
end: 8CC9BF
kind: code
name: tile_graphic_read_header
title: Tile graphic decoder reads the graphic's header byte (tileInfo) through the $EE0000 pointer
confidence: confirmed
tags: [graphics, maps, decompression]
evidence: ["disasm (2026-11-19): $8C:C8B0 tests bit 6 (`bit #$40`): set, a prefix byte follows (bit 7 set: a run of the next word, `$8C:CC62`; clear: that many zero words, DMA from the fixed word at $8C:CC60), then (b & $3F)+1 literal words; in the run form the literals are fetched from +7 ($12 += 3 and $0A = 3), three bytes past where they are stored; checked in VRAM by pointing every table entry at the six bit-6 graphics", "disasm: $8C:C898 reads the 24-bit pointer at $EE0000 + id*3 into $12-$14 (bank via PHA/PLB), then $8C:C8A9 `lda ($12)` reads the header byte; bit 7 set jumps to the compressed path at $8C:C9C0 (docs/map-format/map_tile_graphics_decompression.md §2)", "trace: Mesen2 log of room 0x33's tile load, every fetch at $8C:C8A9 `LDA ($12) [$8FE5D4] = $93` is one tile command (docs/render-script-93.md; tests/memory/render-script-model.test.js parses them)"]
see: [docs/map-format/map_tile_graphics_decompression.md, docs/render-script-93.md]
---
The first byte of each 16×16 tile graphic: bit 7 = compressed (dual stream, bits 6..0 = where the data stream
starts); else bit 6 = a prefix form (a run of one word, or zero words) before the literals, and bits 5..0 = literal
word count − 1. The last literal word repeats to the end. Six vanilla graphics use the bit-6 form (409, 2710, 2839,
3595, 5737, 5739); the two in run form (5737, 5739) show three bytes of the graphic stored after them. `src/games/evermore/maps/chr.ts`
decodes the same format; `maps/render-script-model.js` reads these fetches out of a trace.
