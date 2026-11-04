---
addr: 80A898
end: 80A8A0
size: 9
kind: table
category: 📋
name: tbl_bitmask_cumulative_high
title: Cumulative high bitmask lookup table (bit depths 0 to 8)
confidence: confirmed
tags: [math, bitmask, lookup, table]
evidence: ["disasm: 9 bytes at $80:A898..$80:A8A0: FF FE FC F8 F0 E0 C0 80 00; represents (~((1 << n) - 1)) & 0xFF for n in 0..8"]
see: [routines/tbl_bitmask_cumulative_low.md, routines/tbl_80A8A1.md, routines/tbl_bitmask_powers_of_two.md]
---
Cumulative high bitmask table holding 9 byte entries: `0xFF, 0xFE, 0xFC, 0xF8, 0xF0, 0xE0, 0xC0, 0x80, 0x00`. Evaluated as `(~((1 << n) - 1)) & 0xFF` to clear lower $n$ bits during bit-twiddling and graphics plane reconstruction.
