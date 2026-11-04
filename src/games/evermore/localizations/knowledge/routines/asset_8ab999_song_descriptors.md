---
addr: 8AB999
end: 8AB99F
size: 7
kind: table
category: 📋
name: asset_8ab999_song_descriptors
title: Song descriptors ($8A:B999)
confidence: confirmed
tags: ["asset","table","database"]
evidence: ["Game asset catalog (src/games/evermore/rom/build.ts romRegions)"]
---

Song descriptors: `[count:16]` + count × `[len:16][src:24][spc_dest:16]`; song `0x00` has 407 records Size: 7 bytes at $8A:B999.
