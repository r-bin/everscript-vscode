---
addr: D80000
end: D8496A
size: 18795
kind: table
category: 📋
name: asset_d80000_8_8_sprite_block_pointers
title: 8×8 sprite block pointers ($D8:0000)
confidence: confirmed
tags: ["asset","table","database"]
evidence: ["Game asset catalog (src/games/evermore/rom/build.ts romRegions)"]
---

8×8 sprite block pointers: 6265 × 3 bytes (highest index used); data at `$D1:0000 + ptr`, bit 23 = compressed Size: 18,795 bytes at $D8:0000.

Measured 2026-11-20 (Open Evermore): a block is stored compressed exactly when that is shorter, for all 6,265 8×8
and 4,854 16×16 blocks, so the pixels alone say how a block is stored. One entry shares bytes: 8×8 block 6085 is
read raw from the 32 bytes that are blocks 0 and 407, each compressed, one after the other.
