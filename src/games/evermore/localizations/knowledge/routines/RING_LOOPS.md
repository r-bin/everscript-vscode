---
addr: 8E9944
size: 8
end: 8E994B
kind: table
category: 📋
name: RING_LOOPS
title: Ring id → its loop routine (input, name, what pressing does)
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: $8E:A20E jsr ($9944,x) with X = the ring id"]
see: ["docs/open-evermore/resources.md"]
---
18 words: the routine that runs a ring while it is open: it prints the selected item's name, waits for a button ($8E:ADBC) and, on the confirm button (bit `$0040`), does what the item's index says. Open Evermore: `menus/rings/`.

Previously believed: "CDL pointer table ($8E:9944)" (ptrs_8E9944).
