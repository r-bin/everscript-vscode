---
addr: 8CC88C
size: 29
end: 8CC8A8
kind: code
category: 🧠
name: load_a_16_16_map_graphic_through_3_id_dma_to_vra
title: Load a 16×16 map graphic through `$EE:0000 + 3·id`, DMA to VRAM
confidence: likely
tags: [graphics, ppu, map, system]
evidence: ["legacy: migrated from functions.ts; how it was learned was not recorded (sources then: the everscript wiki ROM map, the ROM tab's points.ts)", "disasm (v0.405.0): A = id; ASL; ADC id; TAX in 16 bits, then lda.l $EE0000,x / $EE0002,x; the bank byte becomes DB (pha/plb) for the read of the data. Vanilla graphics end at id 6687; entries 6688-6690 are zero, bank $EE's next data follows at file 0x2E4E66"]
---
Load a 16×16 map graphic through `$EE:0000 + 3·id`, DMA to VRAM.

The offset `3·id` is computed in 16 bits, so only ids below 21846 reach their pointer; larger ids wrap onto other entries. The table cannot grow in place (its free entries end at id 6690), so a ROM that brings new graphics repoints existing ids (the converted-map export takes the highest vanilla ones: `rooms/rendering/rom-export-own.ts`). The pointer's bank byte is the data bank, so a pointer into the expanded ROM (`$F0`+) works.
