---
addr: 808D4D
size: 53
end: 808D81
kind: code
category: 💾
name: wram_game_state_dma_zero_fill
title: Game save/inventory state staging buffer DMA zero-fill ($80:8D4D)
confidence: verified
evidence: "[\"disasm: configures DMA channel 1: source $80:8000 (ROM zero page), destination WRAM $7E:2258 via $2181/$2183, byte count $0301 (769 bytes); triggers DMA via $420B; clears $7E:2F28 and DP $86; callers include title bootstrap $80:8CC9 and save reload $8D:B492\"]; G1 pass (3/3 reference states, 48/48 fuzzed states, mutation caught)"
see: [knowledge/wram/ALCHEMY_KNOWN_FLAGS.md, routines/gameplay_session_subsystems_init.md]
tags: [wram, dma, save, reconstructed-c, g1-pass]
---
Clears the primary gameplay save and inventory state buffer in WRAM. Configures DMA channel 1 to transfer 769 bytes (`$0301`) from ROM zero page `$80:8000` to WRAM `$7E:2258` (covering formula flags `$7E:2258`, inventory, equipment, and quest flags up to `$7E:2559`), triggers the transfer via `$420B`, and zeroes out flag words `$7E:2F28` and direct page `$86`.
