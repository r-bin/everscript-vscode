---
addr: 80E088
end: 80E0D8
size: 81
kind: padding
category: ⚙️
name: BANK80_PAD_E088
title: Bank $80 alignment padding ($E088)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding scene_transition_enqueue_vram_tile_block in Bank $80"]
---

81 B alignment padding and unmapped ROM space in Bank $80 ($80:E088..$80:E0D8).
