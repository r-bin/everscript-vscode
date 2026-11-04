---
addr: 80C15B
size: 18
end: 80C16C
kind: code
category: 🎮
name: vram_dma_upload_tile_plane_0
title: Upload 16KB tile pattern block to VRAM Plane 0 via DMA ($80:C15B)
confidence: confirmed
evidence: ["disasm: sets VRAM destination address <$2E = $0000; sets transfer length X = $4000 (16KB); invokes DMA upload $80:DD1C; callers: scene setup $80:C0D0"]
see: ["routines/vram_high_byte_dma_stream_ch5.md","routines/mode7_scene_subsystems_init_and_map_load.md"]
tags: ["vram","dma","graphics","plane0"]
---
Transfers 16KB (`$4000` bytes) from source into VRAM address `$0000` (plane 0) via `func_80DD1C` (`$80:DD1C`).
