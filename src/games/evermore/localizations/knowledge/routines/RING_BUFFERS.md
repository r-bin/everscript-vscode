---
addr: 8E9920
size: 36
end: 8E9943
kind: table
category: 📋
name: RING_BUFFERS
title: Ring id → its WRAM buffer (count, cursor, items)
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: $8E:A127 lda $8E9920,x : sta $95 with X = the ring id from the flow at [$97]"]
see: ["docs/open-evermore/resources.md"]
---
18 words, one per ring id (2·ring): the WRAM address of the ring's buffer (`+0` count, `+2` cursor, `+4` up to 16 ring item ids). A ring whose count is 0 is skipped by the flow ($8E:A131). Open Evermore: `menus/rings/`.

Previously believed: "CDL lookup: 18 entries × 2B" (tbl_8E9920).
