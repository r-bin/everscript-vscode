---
addr: 8ADEBE
end: 8ADEC4
size: 7
kind: table
category: 📋
name: asset_8adebe_song_descriptors
title: Song descriptors ($8A:DEBE)
confidence: confirmed
tags: ["asset","table","database"]
evidence: ["Game asset catalog (src/games/evermore/rom/build.ts romRegions)"]
---

Song descriptors: `[count:16]` + count × `[len:16][src:24][spc_dest:16]`; song `0x00` has 407 records Size: 7 bytes at $8A:DEBE.
