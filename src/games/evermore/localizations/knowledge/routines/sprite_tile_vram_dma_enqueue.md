---
addr: 90CFB8
size: 56
end: 90CFEF
kind: code
category: 🧠
name: sprite_tile_vram_dma_enqueue
title: Enqueue sprite graphics tile transfer to VRAM via DMA channel
confidence: verified
tags: [sprites, vram, dma, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: sets source address $26 in bank $90 ($28 = $0090); computes VRAM destination word address $2E based on slot index * 0x0800; sets transfer length in X; calls DMA dispatcher $80:85FA\"]"
  - "Reconstructed in `reconstructed-c/90/90CFB8_sprite_tile_vram_dma_enqueue.c` (SOE_BIND); passes Gate G1 differential verification (34/34 reference states, 0/0 fuzzed states, mutation caught: yes, 52 / 1239 ROM/C instructions per call)."
see: [docs/disassembly/entities/sprite-slicer.md, routines/sprite_vram_3slot_cache_alloc.md, routines/load_sprite_palette.md]
---
Calculates source and destination parameters for a 512-byte sprite tile graphics block in Bank `$90`,
computes the destination VRAM address for the allocated sprite slot, and queues the asynchronous DMA
transfer through `$80:85FA`.
Full disassembly and clean C reconstruction: `docs/disassembly/entities/sprite-slicer.md`.
