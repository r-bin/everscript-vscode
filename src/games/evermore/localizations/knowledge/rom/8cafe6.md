---
addr: 8CAFE6
kind: code
category: 🎨
name: mode7_stream_dialogue_window_rows
title: Mode 7 dialogue window row streamer with fixed matrix parameter ($8C:AFE6)
confidence: confirmed
evidence: ["disasm: loads matrix factor A = #$23FF; branches directly to mode7_tilemap_row_dma_stream ($8C:AFFC); callers: $8E:A0B3, $8F:87FE, $8F:89A3"]
see: [rom/8caffc.md]
tags: [mode7, dialogue, dma]
---
Prepares fixed transformation matrix factor `$23FF` and branches into `mode7_tilemap_row_dma_stream` (`$8C:AFFC`) to stream dialogue window tilemap rows into PPU registers during Mode 7 sequences.
