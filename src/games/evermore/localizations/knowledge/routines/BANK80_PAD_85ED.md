---
addr: 8085ED
end: 8085F9
size: 13
kind: padding
category: ⚙️
name: BANK80_PAD_85ED
title: Bank $80 alignment padding ($85ED)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding cgram_palette_dma_enqueue_or_immediate in Bank $80"]
---

13 B alignment padding and unmapped ROM space in Bank $80 ($80:85ED..$80:85F9).
