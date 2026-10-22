---
addr: 8C8CFC
size: 297
kind: table
category: 📋
name: DOG_XP_PER_LEVEL
title: Dog XP needed for the next level, by level
confidence: likely
tags: [dog, exp, progression]
evidence: ["disasm: $8D:B686 loads the dog's level byte $0A9A, computes (level + 1) * 3 and reads $8C:8CF9,X (= $8C:8CFC + level * 3) into $7E:4FCB-4FCD", "read: 99 rising 24-bit values in the clean US ROM, 0, 35, 115, 271 … 7562384; the bytes after them belong to another table (v0.327.0)"]
see: [rom/8c8bd0.md]
---
The dog's version of the Boy's XP table (`$8C:8BD0`), right after it: the total experience the
dog needs for the next level, 3 bytes per level, indexed by the dog's level byte at `$0A9A` and
copied to `$7E:4FCB` (the dog's entity at `$4F37` + `$94`, the same offset as the Boy's `$4F1D`).
The dog needs more XP than the Boy at every level. 99 entries and no `$FFFFFF` end mark.
