---
addr: 8085FA
size: 86
end: 80864F
kind: code
category: 🧠
name: cgram_palette_dma_enqueue_or_immediate
title: Dual-mode CGRAM palette DMA transfer (Direct Channel 1 vs 32-slot deferred queue)
confidence: verified
tags: [graphics, cgram, palette, dma, hardware, reconstructed-c, g1-pass]
evidence: ["reconstructed-c/80/8085FA_cgram_palette_dma_enqueue_or_immediate.c passes Gate G1 (28/28 reference states, 448/448 fuzzed, mutation caught)"]
see: [docs/disassembly/engine-core/hardware-dma-and-prng.md, routines/vram_dma_upload_tile_block.md]
---
Uploads color palette data to PPU CGRAM using either direct hardware DMA Channel 1 or a 32-slot deferred transfer queue:
- **Immediate mode (forced blank)**: When `$0106` (INIDISP shadow) bit 7 is set, increments lock `$0F3C`, sets destination palette index via `$2121` (`CGADD`), programs DMA channel 1 registers (`$4310` = mode `$2200` to `CGDATA`, `$4312` = 16-bit source address from DP `$26`, `$4314` = source bank from DP `$28`, `$4315` = length from `X`), asserts `$420B` (`MDMAEN` = `$02`), decrements lock `$0F3C`, and returns with 16-bit registers and X = `$2200`.
- **Deferred queue mode (active display)**: Writes a 7-byte descriptor into the CGRAM DMA ring buffer at `$1292,X` (indexed by queue cursor `$128E`):
  - `+$00` (word): source offset from DP `$26`
  - `+$02` (byte): source bank from DP `$28`
  - `+$03` (word): destination CGRAM palette word/byte index from DP `$2E`
  - `+$05` (word): length in bytes from `X` (staged into DP `$12`)
  Advances cursor by 7 bytes (`ADC #$0007`), wrapping to 0 when reaching 224 bytes (`$00E0` = 32 slots × 7 bytes), and writes updated cursor to `$128E`.

## Callers
- Palette upload helpers, scene transitions, and character palette loader routines.
