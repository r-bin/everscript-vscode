---
addr: 8B82DD
end: 8B82E3
size: 7
kind: table
category: 📋
name: asset_8b82dd_song_descriptors
title: Song descriptors ($8B:82DD)
confidence: confirmed
tags: ["asset","table","database"]
evidence: ["Game asset catalog (src/games/evermore/rom/build.ts romRegions)"]
---

Song descriptors: `[count:16]` + count × `[len:16][src:24][spc_dest:16]`; song `0x00` has 407 records Size: 7 bytes at $8B:82DD.
