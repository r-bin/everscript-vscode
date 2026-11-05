---
addr: 808650
size: 98
end: 8086B1
kind: code
category: 🧠
name: vram_dma_upload_tile_block
title: Direct DMA channel 1 block transfer to VRAM with VRAM lock protection
confidence: confirmed
tags: [graphics, vram, dma, hardware]
evidence: ["disasm: checks $0106 bit 7; when set (forced blank), increments VRAM lock $0F3A, programs VMAIN $2115=0x80, sets DMA1 source $4312-$4314, destination VMADD $2116, byte length $4315, mode $1801, triggers $420B=0x02, and decrements $0F3A; when clear ($80:8686), queues an 8-byte descriptor into $013F,x at cursor $013D and advances $013D = ($013D + 8) & $01FF", "recomp: reconstructed-c/80/808650_vram_dma_upload_tile_block.c (G1 39/39, 624/624 fuzzed)"]
see: [routines/dialogue_glyph_stream_vram.md, routines/map_anim_tile_channel_tick_and_vram_stream.md, routines/nmi_handler.md, wram/7e013d.md, wram/7e013f.md]
---
Transfers or queues a block of graphical tile data (`DP $26..$28` source pointer, `DP $2E` destination VRAM word address, `X` byte length) for PPU VRAM in word-increment mode (`$80`):
- **Forced-blank immediate path (`$80:8657`, when `$0106` bit 7 is set):**
  - Sets `DB = $80` (`PHB; PHK; PLB`) and increments VRAM access lock counter `$0F3A` (`VRAM_DMA_LOCK`).
  - Configures `$2115` (`VMAIN` = `$80`) and `$2116` (`VMADD` = `DP $2E`).
  - Programs DMA channel 1 (`$4310` = `$1801`, `$4312..$4314` = `DP $26..$28`, `$4315` = `X`) and triggers `$420B` (`MDMAEN` = `$02`).
  - Decrements `$0F3A`, restores `DB` (`PLB`), and returns with 16-bit `A`/`X` (`REP #$30`).
- **Active-display ring-buffer path (`$80:8686`, when `$0106` bit 7 is clear):**
  - Stages `X` into `DP $12` and loads the current ring-buffer cursor `X = $013D` (`VRAM_DMA_QUEUE_CURSOR`).
  - Writes an 8-byte descriptor at `$013F,x` (`VRAM_DMA_QUEUE`): `+$00` mode `$80`, `+$01..$02` source address `DP $26`, `+$03` source bank `DP $28`, `+$04..$05` destination VRAM word address `DP $2E`, `+$06..$07` transfer size `DP $12`.
  - Advances `$013D = ($013D + 8) & $01FF` and returns with `A = new $013D`, `X = old $013D`.
- Bound C implementation: `reconstructed-c/80/808650_vram_dma_upload_tile_block.c`.
