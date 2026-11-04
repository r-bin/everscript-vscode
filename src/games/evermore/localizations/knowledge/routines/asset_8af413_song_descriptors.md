---
addr: 8AF413
end: 8AF419
size: 7
kind: table
category: 📋
name: asset_8af413_song_descriptors
title: Song descriptors ($8A:F413)
confidence: confirmed
tags: ["asset","table","database"]
evidence: ["Game asset catalog (src/games/evermore/rom/build.ts romRegions)"]
---

Song descriptors: `[count:16]` + count × `[len:16][src:24][spc_dest:16]`; song `0x00` has 407 records Size: 7 bytes at $8A:F413.
