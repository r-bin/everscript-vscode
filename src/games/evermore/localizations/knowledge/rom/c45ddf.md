---
addr: C45DDF
size: 70
kind: table
category: ⚗️
name: ALCHEMY_ANIM_MAP
title: Alchemy formula → its block in bank $91
confidence: likely
tags: [alchemy]
evidence: ["read: 35 words, all even, 0x00..0x42 (34 distinct; formulas 0 Acid Rain and 20 Laser both hold 0x02) — read from the ROM (v0.203.0)", "read: each value + $91:80A6 gives a $91 address equal to the everscript enum ALCHEMY_TYPE_ANIMATION / _PROJECTILE value of the same formula (Acid Rain $86F0, Crush $8A9C, Heal $886C, Flash $8756, Hard Ball $926C)"]
see: [src/games/evermore/localizations/knowledge/rom/9180a6.md, src/games/evermore/scripts-tab/model/alchemy.js]
---
One word per alchemy formula, in formula order (Acid Rain = 0 … Super Heal = 34, the order of
the everscript enum `ALCHEMY_INDEX`). The word is a byte offset into the table at `$91:80A6`,
which gives the formula's block in bank `$91` — what the cast runs from and which effect
animations it plays. Two formulas can share a block: Laser re-uses Acid Rain's.

## Notes
- Previously believed (tables.js, the alchemy skill): "animation id per formula" / "animation
  sequence id". It is not an animation id; it selects a `$91` block, and the block names the
  animation records.
- Which code reads it was not traced; the meaning comes from the values matching the enum.
