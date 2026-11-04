---
addr: 8092eb
end: 809432
size: 328
kind: code
name: oam_sprite_composite_blit_and_clip
title: OAM sprite composite blitting and screen boundary clipping engine
confidence: confirmed
tags: [graphics, oam, sprite, clipping, render]
evidence: ["disasm: branch matrix loc_C092EB..loc_C0946B checking bounding box coordinates, blending into OAM sprite buffer via ora.l data_C09479-$400000,x and lda.l data_C094D9-$400000,x (out/recomp/asar/banks/bank_C0.asm:3911)"]
see: [src/games/evermore/localizations/knowledge/routines/oam_chunk_attribute.md]
---
OAM sprite composite blitting and screen boundary clipping engine:
- Evaluates sprite position against screen viewport boundaries (top, bottom, left, right).
- Applies coordinate clipping to eliminate off-screen sprite slices.
- Unrolls sprite tile descriptor composition into OAM display lists using bitmask patterns at `$80:9479` and `$80:94D9`.
- Routes multi-tile sprite frames to OAM low table (X/Y coordinates, tile indices, attributes) and high table (size bit and ninth X position bit).
