---
addr: 808F85
end: 808FED
size: 105
kind: code
category: 🧠
name: vram_oam_buffer_dma_commit_on_nmi
title: Flush and reset dynamic VRAM and OBJ tile allocation LRU queues upon V-Blank
confidence: confirmed
tags: [oam, vram, dma, vblank, graphics, lru, queue, reconstructed-c, g1-pass]
reconstructed_c: reconstructed-c/80/808F85_vram_oam_buffer_dma_commit_on_nmi.c
evidence: ["reconstructed-c/80/808F85_vram_oam_buffer_dma_commit_on_nmi.c passes Gate G1 (37/37 reference states, 592/592 fuzzed, mutation caught)", "disasm: checks frame commit latch DP $D9; if zero returns immediately via RTL; otherwise clears $D9; zeroes DMA staging pointers DP $CB, $CD, $CF, $D1; switches to 8-bit mode (SEP #$30); unlinks and resets dynamic OBJ tile LRU queue ($7E:9726, $7E:97A7, $7E:96A5); unlinks and resets VRAM tile LRU queue ($7E:AB79, $7E:ABDA, $7E:AB18); resets queue sentinels ($9726=$81, $97A8=$81, $AB79=$61, $ABDB=$61); resets active VRAM page DP $D8=$96; restores 16-bit mode (REP #$30) and DB (PLB), returning via RTL"]
see: [routines/oam_finalize_and_blank_unused.md, knowledge/wram/TIER1_LRU_TAIL_NODE.md, knowledge/wram/VRAM_TILE_LRU_MOST_RECENT.md]
---
Flushes and resets the dynamic Object (OBJ) and VRAM tile allocation LRU queues at the start of a new frame / V-Blank:
1. Tests the frame commit ready flag `DP $D9`. If zero, exits immediately via RTL.
2. Clears `DP $D9 = 0`.
3. Clears dynamic DMA queue staging cursors: `DP $CB = 0`, `DP $CD = 0`, `DP $CF = 0`, `DP $D1 = 0`.
4. Switches CPU to 8-bit registers (`SEP #$30`).
5. Evaluates the OBJ tile LRU queue tail `$7E:9726`: if not equal to sentinel `$81`, unlinks the active tile node and links it back to the free pool at `$7E:96A5`.
6. Evaluates the VRAM tile LRU queue tail `$7E:AB79`: if not equal to sentinel `$61`, unlinks the active tile node and links it back to the free pool at `$7E:AB18`.
7. Resets queue sentinels: `$7E:9726 = 0x81`, `$7E:97A8 = 0x81`, `$7E:AB79 = 0x61`, `$7E:ABDB = 0x61`.
8. Resets active VRAM page selector `DP $D8 = 0x96`.
9. Restores 16-bit mode (`REP #$30`) and entry Data Bank (`PLB`), returning via RTL.

## Callers
- `$80:858C` (`wait_for_nmi`)
- `$80:C1A2` (`FUN_80c1a2`)
- `$80:C95B` (`FUN_80c95b`)
- `$8F:9817` (`field_spare_time_loop`)
