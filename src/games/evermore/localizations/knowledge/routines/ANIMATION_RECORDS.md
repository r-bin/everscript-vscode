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
evidence: ["rom: 783 groups / 1,752 4-byte records spanning $C4:3E3A-$5999; head +$03 flags strictly $00 (488 1-facing), $40 (274 4-facing via $90:815B [0:'north', 4:'east', 8:'south', 12:'west']), $80 (21 8-facing), non-head flags = $00", "Open Evermore animations/groups/ explodes and implodes all 783 groups"]
---
4 bytes [script:16][script_bank:8][flags:8]; heads of 1, 4 ($40) or 8 ($80) facings.
