---
addr: D28000
end: D2801A
size: 27
kind: padding
category: ⚙️
name: BANKD2_PAD_8000
title: Bank $D2 alignment padding ($8000)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding ROOM_ENTER_SCRIPT_TABLE in Bank $D2"]
---

27 B alignment padding and unmapped ROM space in Bank $D2 ($D2:8000..$D2:801A).
