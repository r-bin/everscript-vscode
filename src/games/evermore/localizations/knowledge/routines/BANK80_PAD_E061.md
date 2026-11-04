---
addr: 80E061
end: 80E0D8
size: 120
kind: padding
category: ⚙️
name: BANK80_PAD_E061
title: Bank $80 alignment padding ($E061)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding scene_transition_enqueue_vram_tile_block in Bank $80"]
---

120 B alignment padding and unmapped ROM space in Bank $80 ($80:E061..$80:E0D8).
