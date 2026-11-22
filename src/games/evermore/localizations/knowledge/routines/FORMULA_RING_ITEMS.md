---
addr: C45BAF
end: C45BF4
size: 70
kind: table
category: ⚗️
name: FORMULA_RING_ITEMS
title: Each formula's ring item (2·ring item id)
confidence: confirmed
tags: ["alchemy", "ring-menu", "tables"]
evidence: ["disasm v0.456.0: ring_alchemy_build ($8E:9B50) turns the formulas put on the ring ($0AD2, 9 slots) into ring items through it", "rom: 35 words, each 2·an alchemy ring item id ($48-$8C), not in formula order"]
see: ["routines/ring_alchemy_build.md", "docs/open-evermore/resources.md"]
---
One word per formula: the ring item the alchemy ring shows for it. Open Evermore writes it as `ring_item` in `alchemy/formulas/<name>.json`.

Previously named `tbl_C45BAF` (a CDL lookup table, meaning not recorded).
