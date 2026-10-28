---
addr: 8CAF2B
end: 8CAF80
kind: code
category: 🧠
name: window_tilemap_buffer_init
title: Window Tilemap Line Buffer & DMA Staging Initializer
confidence: confirmed
tags: [window, ui, dialogue, tilemap, dma]
evidence: ["disasm: takes window record index in Y ($034D, $03DD, $0435); reads window row offset +$1C,Y and height +$1E,Y; calculates shadow tilemap buffer offset via hardware multiplier $4202/$4216; sets WRAM destination registers $2181-$2183 to Bank $7F ($7F:C800 shadow buffer); configures DMA channel 1 transfer parameters ($4311=$80 WMDATA, source $4312 from +$26,Y, font bank $4314=$C4, length $4315=16 bytes); clears and aligns active text line staging buffer; returns via RTS", "callers: dialogue_stream_target_actor_name ($8C:89FD), oracle_render_target_stats_card ($8E:8A1D), dialogue_format_and_append_line ($8C:9E03), window_tilemap_dma_commit ($8C:ACD0), expand_current_amount_in_text ($8C:D5AA), shop_mode_catalog_loader ($8E:9EF0), script_op_a0 ($8C:E628) and 4 more"]
see: [rom/80b21f.md, ram/7fc800.md, docs/disassembly/ui/dialogue-window.md]
---
Initializes the tilemap staging line buffer and DMA transfer channel for a window record passed in register `Y`:
- Reads window line spacing, column offset (`+$1C,Y`), and vertical dimension (`+$1E,Y`) from the active window descriptor.
- Computes destination VRAM/WRAM buffer coordinates via the SNES hardware multiplication coprocessor (`$4202`/`$4216`).
- Prepares WRAM destination registers `$2181`–`$2183` targeting the Bank `$7F` shadow tilemap memory buffer (`$7F:C800`).
- Configures DMA channel 1 registers targeting the Bank `$C4` proportional font glyph dictionary (`$4314 = $C4`, `$4311 = $80` WMDATA, transfer count 16 bytes per character tile).
- Clears active text line memory and prepares window border geometry for stream formatting routines.
