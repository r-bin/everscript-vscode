---
addr: 8CAFE6
size: 5
end: 8CAFEA
kind: code
category: 🎨
name: mode7_stream_dialogue_window_rows
title: Mode 7 dialogue window row streamer with fixed matrix parameter ($8C:AFE6)
confidence: verified
evidence: "[\"disasm: loads matrix factor A = #$23FF; branches directly to mode7_tilemap_row_dma_stream ($8C:AFFC); callers: $8E:A0B3, $8F:87FE, $8F:89A3\"]; G1 pass (18/18 reference states, 30/30 fuzzed states, mutation caught)"
see: [routines/mode7_tilemap_row_dma_stream.md]
tags: [mode7, dialogue, dma, reconstructed-c, g1-pass]
---
Prepares fixed transformation matrix factor `$23FF` and branches into `mode7_tilemap_row_dma_stream` (`$8C:AFFC`) to stream dialogue window tilemap rows into PPU registers during Mode 7 sequences.
