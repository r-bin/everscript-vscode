---
addr: 8ADC1A
end: 8ADC1B
size: 2
kind: table
category: 📋
name: asset_8adc1a_song_descriptors
title: Song descriptors ($8A:DC1A)
confidence: confirmed
tags: ["asset","table","database"]
evidence: ["Game asset catalog (src/games/evermore/rom/build.ts romRegions)"]
---

Song descriptors: `[count:16]` + count × `[len:16][src:24][spc_dest:16]`; song `0x00` has 407 records Size: 2 bytes at $8A:DC1A.
