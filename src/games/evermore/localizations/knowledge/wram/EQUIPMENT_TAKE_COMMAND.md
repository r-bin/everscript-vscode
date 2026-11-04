---
addr: 7E243F
size: 2
kind: var
name: EQUIPMENT_TAKE_COMMAND
title: Pending equipment item revoke/take ID
lifetime: frame
confidence: confirmed
tags: [inventory, equipment]
evidence: ["disasm: func_CF9210 ($8F:9240) checks $243F; if non-negative, inverts bitmask from $8CBBD8 (tbl_CCBBD8), clears owned bit in $7E:2261..$7E:2264 using $8CBBB0, recalculates stats, and resets $243F to $FFFF", "scripts: Nobilia Market Room 10 relic vendor ($96:9414) sets <0x243f> to revoke Moxa Stick ($0C) when granting Ruby Heart ($10) and vice versa"]
see: [ram/7e243d.md, ram/7e2441.md]
---
One-shot command register used to revoke/take equipment items (weapons, armor, collars) from the player's inventory. Direct counterpart to `EQUIPMENT_GRANT_COMMAND` (`ram/7e243d`).

When non-negative, `func_CF9210` (`$8F:9240`) reads the equipment index in `$7E:243F`, looks up the target WRAM byte offset in `$8C:BBB0` (`$7E:2261`..`$7E:2264`) and bitmask in `$8C:BBD8`, inverts the mask with `EOR #$FFFF`, clears the owned bit via `AND`, triggers player stat recalculation (`character_stat_recalculation_armor`), updates active party stats, and resets `$7E:243F` to `$FFFF` (idle).
