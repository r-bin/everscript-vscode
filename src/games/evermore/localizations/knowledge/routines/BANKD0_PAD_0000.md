---
addr: D00000
end: D07FFF
size: 32768
kind: padding
category: ⚙️
name: BANKD0_PAD_0000
title: Bank $D0 alignment padding ($0000)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding ANIMATION_VM_DISPATCH in Bank $D0"]
---

32,768 B alignment padding and unmapped ROM space in Bank $D0 ($D0:0000..$D0:7FFF).
