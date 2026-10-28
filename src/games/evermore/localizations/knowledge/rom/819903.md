---
addr: 819903
end: 8199D7
size: 213
kind: table
category: 🎵
name: tbl_song_packages
title: Master music soundtrack & sound package pointer table
confidence: confirmed
tags: [audio, music, spc, soundbank]
evidence: ["disasm: audio engine $8C:8236 reads 24-bit pointer from $81:9903,x to load BRR sample blocks and music sequence tracks", "header: count byte at $81:9900 = 0x46 (71 packages)"]
see: [rom/c19903.md, docs/disassembly/engine-core/rom-tables.md]
---
Master audio package table for the Secret of Evermore soundtrack and sound effects.
Contains 71 24-bit far pointers (213 bytes total) addressing music tracks and soundbank descriptor headers located in ROM Banks `$8A` and `$8B`.
Read by the APU loader at `$8C:8236`.
