---
addr: B08000
end: B0800B
size: 12
kind: padding
category: ⚙️
name: BANKB0_PAD_8000
title: Bank $B0 alignment padding ($8000)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding script_abs_b0800c_select_barrier in Bank $B0"]
---

12 B alignment padding and unmapped ROM space in Bank $B0 ($B0:8000..$B0:800B).
