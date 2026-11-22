---
addr: C45BA5
end: C45BAE
size: 10
kind: table
category: ⚗️
name: LEVEL_MULTIPLIER
title: Level multiplier
confidence: confirmed
evidence: ["legacy: migrated from tables.js; how it was learned was not recorded (sources then: the everscript wiki ROM map, the ROM tab's points.ts)"]
---
[2,4,7,11,15,20,26,32,39,46] Lv0..9.

Read twice in bank `$91` (`lda.l $C45BA5,x`, X = the level, `and #$FF`, `xba`): the high byte of the `$4202` multiplier word (v0.456.0). Open Evermore: `alchemy/alchemy_levels/`.
