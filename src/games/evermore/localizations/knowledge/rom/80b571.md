---
addr: 80B571
end: 80B5B0
size: 64
kind: table
category: 📋
name: tbl_title_logo_orbit_offsets_wrap
title: Circular orbital coordinate offset lookup table (wrap cycle: 16 entries × 4B)
confidence: confirmed
tags: [title, orbit, coordinates, circle, motion, table]
evidence: ["disasm: 64 bytes at $80:B571..$80:B5B0 containing 16 pairs of signed 16-bit word offsets; identical repeat cycle of tbl_80B531 providing modulo-free circular indexing for orbital motion"]
see: [routines/tbl_80B531.md, rom/80b5b6.md]
---
Circular orbital coordinate offset lookup table containing 16 pairs of signed 16-bit word offsets `(dx, dy)` defining a circular motion path with radius 4:
- Entries: `(-1, -3), (-3, -3), (-3, -1), (-4, 0), (-3, 1), (-3, 3), (-1, 3), (0, 4), (1, 3), (3, 3), (3, 1), (4, 0), (3, -1), (3, -3), (1, -3), (0, -4)`
Follows immediately after `tbl_80B531` as a contiguous second cycle, allowing phase-shifted circular indexing without branching modulo arithmetic.
