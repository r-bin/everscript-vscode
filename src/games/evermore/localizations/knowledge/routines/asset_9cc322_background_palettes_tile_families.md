---
addr: 9CC322
end: 9CF0C1
size: 11680
kind: data
category: 🎨
name: asset_9cc322_background_palettes_tile_families
title: Background palettes (tile families) ($9C:C322)
confidence: confirmed
tags: ["asset","graphics","chr"]
evidence: ["Game asset catalog (src/games/evermore/rom/build.ts romRegions)"]
---

Background palettes (tile families): 365 × 32 bytes, `$9C:C322 + 32·family`; up to 7 loaded per room by `$90:D020` Size: 11,680 bytes at $9C:C322.

## Readers, and moving the array (measured 2026-11-19)

The family loader at `$90:D05C` is the only reader: `adc #$C322` (file `0x10D065`) adds the array's address to
`32·family`, `lda #$9C` (file `0x10D079`) sets its bank (the `$80–$BF` FastROM form, so the array must sit in an
upper bank half and never cross a bank; at most 1024 families). `tools/open-evermore` rewrites only those two
operands and moved the array to `$9C:8000`, `$9C:8F3C` and `$9C:D25E` (seeds 2, 99, 1); the attract loop and the
2m20 intro played identically, and no WRAM byte held a pointer into the array (`docs/open-evermore/progress.md`
S2). The table hack moved it to `$B9:8000` the same way (`tools/table-hack/tables.js` `map_palettes`).
