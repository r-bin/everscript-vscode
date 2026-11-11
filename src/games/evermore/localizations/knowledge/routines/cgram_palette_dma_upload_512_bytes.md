---
addr: 80C17F
size: 19
end: 80C191
kind: code
category: 🎮
name: cgram_palette_dma_upload_512_bytes
title: Upload full 512-byte CGRAM color palette buffer via DMA ($80:C17F)
confidence: confirmed
evidence: ["disasm: sets CGRAM target address <$2E = $0000; sets transfer size X = $0200 (512 bytes); commits via cgram_palette_dma_enqueue_or_immediate $80:85FA; callers: scene setup $80:C0D0"]
see: ["routines/cgram_palette_dma_enqueue_or_immediate.md","routines/mode7_scene_subsystems_init_and_map_load.md"]
tags: ["cgram","palette","dma","color", "mode7"]
---
Transfers full 512-byte (`$0200`) CGRAM color palette buffer from source into CGRAM via `cgram_palette_dma_enqueue_or_immediate` (`$80:85FA`).
