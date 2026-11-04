---
addr: 80FFC0
end: 80FFDF
size: 32
kind: padding
category: ⚙️
name: BANK80_PAD_FFC0
title: Bank $80 alignment padding ($FFC0)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding rom_vectors in Bank $80"]
---

32 B alignment padding and unmapped ROM space in Bank $80 ($80:FFC0..$80:FFDF).
