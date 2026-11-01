---
addr: 7E0C8F
size: 2
kind: var
name: RING_MENU_ALCH_FORMULA_COUNT
title: Total learned alchemy formulas populated into secondary ring menu
lifetime: room
confidence: confirmed
tags: [ring-menu, alchemy, spells]
evidence: ["disasm: func_8E9A2F ($8E:9A2F) scans learned formula bitmasks in $7E:2345..$7E:2346, writes formula IDs into $0C93,X, and increments count in $0C8F", "disasm: compares active cursor against $0C8F and stores into $0C91"]
see: [ram/7e0c91.md, rom/8e9a2f.md]
---
16-bit count of learned alchemy formulas populated into secondary formula ring menu slots (`$7E:0C93`).
