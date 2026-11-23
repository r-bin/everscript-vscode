---
addr: 8CC3F8
size: 35
end: 8CC41A
kind: code
category: 💾
name: count_quest_progress_flags
title: Counts the named items held (charms, key items)
confidence: confirmed
evidence: ["disasm: switches DBR to $7E; iterates 20 quest milestones (X=$26 down to 0, step 2); loads WRAM address from $8C:BBB0,X into DP $14; tests bitmask from $8C:BBD8,X; increments counter $12 for each match; returns total count in A; caller: $8E:9B6F"]
see: [routines/ring_items_build.md]
tags: [quests, flags, progress]
---
Counts the named items whose flag is set (`$8C:BBB0` words, `$8C:BBD8` masks, X from `$26` down): `ring_items_build` shows
the Pouch when it is not 0. The name (quest milestones) is a misreading.
