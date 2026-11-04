---
addr: 808010
end: 80801F
size: 16
kind: padding
category: ⚙️
name: BANK80_PAD_8010
title: Bank $80 alignment padding ($8010)
confidence: confirmed
tags: ["unused","padding"]
evidence: ["ROM alignment gap preceding reset_handler in Bank $80"]
---

16 B alignment padding and unmapped ROM space in Bank $80 ($80:8010..$80:801F).
