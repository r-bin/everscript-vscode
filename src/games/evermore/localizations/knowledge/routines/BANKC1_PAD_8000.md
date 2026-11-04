---
addr: C18000
end: C19902
size: 6403
kind: padding
category: ⚙️
name: BANKC1_PAD_8000
title: Bank $C1 alignment padding ($8000)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding SONG_POINTER_TABLE in Bank $C1"]
---

6,403 B alignment padding and unmapped ROM space in Bank $C1 ($C1:8000..$C1:9902).
