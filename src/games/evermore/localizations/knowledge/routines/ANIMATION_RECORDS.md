---
addr: C43E3A
end: C45999
size: 7008
kind: table
category: 🎞️
name: ANIMATION_RECORDS
title: Animation records
confidence: confirmed
tags: [script, table]
evidence: ["rom: 783 groups / 1,752 4-byte records spanning $C4:3E3A-$5999; head +$03 flags strictly $00 (488 1-facing), $40 (274 4-facing via $90:815B [0:'north', 4:'east', 8:'south', 12:'west']), $80 (21 8-facing), non-head flags = $00", "Open Evermore animations/ explodes and implodes all 783 animations with their scripts (v0.465.0): 1,595 unique $C7-$C9 scripts, 52,122 bytes, longest 251; 195 of them cross a 256-byte page"]
---
4 bytes [script:16][script_bank:8][flags:8]; heads of 1, 4 ($40) or 8 ($80) facings.
The 1,595 scripts the records point at lie in `$C7`-`$C9` (23,451, 5,227 and 23,358 bytes); the `animate()` table `$C4:3C92` (212 words) reaches them through these records.
