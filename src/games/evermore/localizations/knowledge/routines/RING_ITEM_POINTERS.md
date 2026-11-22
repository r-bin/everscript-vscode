---
addr: 8E8000
size: 324
end: 8E8143
kind: table
category: 📋
name: RING_ITEM_POINTERS
title: Ring item pointers: ring item id → its entry in bank $8E
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: every ring loop reads lda $8E8000,x with X = the item id from the ring buffer, then the entry at $8E:0000+that"]
see: ["docs/open-evermore/resources.md"]
---
162 words, one per ring item id (ids step by 2, `$0000`-`$0142`): the 16-bit address of the item's 8-byte entry in `RING_ITEMS`. The entries are not in id order. Also mirrored at `$CE:8000` (`RING_MENU_ICON_TABLE`, the same bytes through the HiROM mirror). Open Evermore: `menus/ring_items/` (written in place).

Previously believed: "CDL lookup: 162 entries × 2B" (tbl_8E8000).
