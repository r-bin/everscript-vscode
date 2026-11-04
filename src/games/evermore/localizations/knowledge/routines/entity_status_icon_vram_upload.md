---
addr: 8F90E8
end: 8F9103
size: 28
kind: code
category: 🧠
name: entity_status_icon_vram_upload
title: Upload entity HUD status condition icon tile block to VRAM via DMA
confidence: confirmed
tags: [entities, status, hud, vram, dma]
evidence: ["disasm: computes destination address from $0561 + $0B41, sets source buffer pointer to $0569, sets length 16 bytes (LDX #$0010), invokes vram_dma_upload_tile_block ($80:8650), restores data bank (PLB) and exits via RTL at $8F:90E8..$8F:9103"]
see: [knowledge/wram/HUD_DOG_STATUS_WIDGET.md, routines/vram_dma_upload_tile_block.md, routines/entity_combat_hitbox_and_state_init.md]
---
Streams an updated 16-byte HUD status condition icon tile into SNES VRAM OBJ character memory via direct DMA channel 1:
- Computes VRAM destination address offset from base `$0B41` plus slot offset `$0561`.
- Configures 24-bit source buffer pointer to direct page `$0569`.
- Transfers 16 bytes via `vram_dma_upload_tile_block` (`$80:8650`).
- Restores caller data bank (`PLB`) and exits via `RTL`.
