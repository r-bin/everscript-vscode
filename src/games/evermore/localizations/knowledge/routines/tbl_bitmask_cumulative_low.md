---
addr: 80A88F
end: 80A897
size: 9
kind: table
category: 📋
name: tbl_bitmask_cumulative_low
title: Cumulative low bitmask lookup table (bit depths 0 to 8)
confidence: confirmed
tags: [math, bitmask, lookup, table]
evidence: ["disasm: 9 bytes at $80:A88F..$80:A897: 00 01 03 07 0F 1F 3F 7F FF; represents (1 << n) - 1 for n in 0..8"]
see: [routines/tbl_80A887.md, routines/tbl_bitmask_cumulative_high.md, routines/tbl_bitmask_powers_of_two.md]
---
Cumulative low bitmask table holding 9 byte entries: `0x00, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF`. Evaluated as `(1 << n) - 1` to mask out lower $n$ bits during graphic tile decoding, font decompression, and bitfield unpacking.
