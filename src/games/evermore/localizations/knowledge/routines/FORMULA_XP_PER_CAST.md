---
addr: C45B9C
end: C45BA4
size: 9
kind: table
category: ⚗️
name: FORMULA_XP_PER_CAST
title: Formula XP per cast
confidence: confirmed
evidence: ["legacy: migrated from tables.js; how it was learned was not recorded (sources then: the everscript wiki ROM map, the ROM tab's points.ts)"]
---
[10,5,4,3,2,2,1,1,1] Lv0..8.

Read by `alchemy_formula_award_cast_xp_and_level` (`$91:CD54`, `lda.l $C45B9C,x` with X = the level, `and #$FF`): a byte per level 0-8 (v0.456.0). Open Evermore: `alchemy/alchemy_levels/`.
