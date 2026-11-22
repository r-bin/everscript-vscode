---
addr: 8E9968
size: 36
end: 8E998B
kind: table
category: 📋
name: RING_FLAGS
title: Ring id → its display flags ($05AB)
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: $8E:A120 lda $8E9968,x : sta $05AB; $8E:A1B8 bit #$0001 sets up a window around the ring"]
see: ["docs/open-evermore/resources.md"]
---
18 words copied to `$05AB` when the ring opens. Bit 0: the ring gets a window (HDMA tables from `$7F:C8B8` / `$7F:C8F8`), set on the shop rings. Other bits: not yet traced. Open Evermore: `menus/rings/`.

Previously believed: "CDL lookup: 18 entries × 2B" (tbl_8E9968).
