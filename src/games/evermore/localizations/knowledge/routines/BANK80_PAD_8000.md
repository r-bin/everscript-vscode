---
addr: 808000
end: 80801F
size: 32
kind: padding
category: ⚙️
name: BANK80_PAD_8000
title: Bank $80 alignment padding ($8000)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding reset_handler in Bank $80"]
---

32 B alignment padding and unmapped ROM space in Bank $80 ($80:8000..$80:801F).
