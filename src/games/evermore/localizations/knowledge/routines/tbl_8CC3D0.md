---
addr: 8CC3D0
end: 8CC3F3
size: 36
kind: table
category: 📋
name: tbl_8CC3D0
title: Named items (charms, key items) — each one's description
confidence: confirmed
tags: [table, menu, charm, item, text]
evidence: ["disasm: $8C:C3BB lda.l $8CC3D0,x / sta $22, lda #$00C4 (the bank, $8C:C3C1), print into window $03A5: X = 2·the picked entry (2026-11-23)", "test: Open Evermore v0.461.0, a 21st named item's description shows in game when it is picked"]
see: [routines/tbl_8CBBB0.md]
---
20 words, entry `k` at `2·k`: the line shown under the named items list when entry `k` is picked, a 16-bit pointer into
bank `$C4`. The six key items share one ("Rare Item").

Previously believed: 9 entries of 4 bytes, with `$8C:C3F4`-`$C3F7` padding; those 4 bytes are entries 18 and 19.
