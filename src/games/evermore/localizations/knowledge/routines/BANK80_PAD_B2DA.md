---
addr: 80B2DA
end: 80B379
size: 160
kind: padding
category: ⚙️
name: BANK80_PAD_B2DA
title: Bank $80 alignment padding ($B2DA)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding alloc_circular_hud_text_buffer_slot in Bank $80"]
---

160 B alignment padding and unmapped ROM space in Bank $80 ($80:B2DA..$80:B379).
