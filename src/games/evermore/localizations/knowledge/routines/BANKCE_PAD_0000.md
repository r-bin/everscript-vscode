---
addr: CE0000
end: CE7FFF
size: 32768
kind: padding
category: ⚙️
name: BANKCE_PAD_0000
title: Bank $CE alignment padding ($0000)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding RING_MENU_ICON_TABLE in Bank $CE"]
---

32,768 B alignment padding and unmapped ROM space in Bank $CE ($CE:0000..$CE:7FFF).
