---
addr: C45BF5
end: C45C3A
size: 70
kind: table
category: ⚗️
name: ALCHEMY_TARGET
title: ALCHEMY_TARGET
confidence: confirmed
evidence: ["disasm: combat spell targeting routine loads targeting bitfield at $C4:5BF5,x per formula id (0..34)", "data: 35 words determining reticle locking rules for player, companion, party, and enemy targets"]
see: [wram/TARGET_REQUEST_MASK.md, routines/tbl_C45A84.md, routines/weapon_entries.md, routines/ALCHEMY_FORMULA_TEXT.md, docs/disassembly/engine-core/rom-tables.md]
---
Target words for all 35 formulas (`$C4:5BF5`..`$C4:5C3A`, 70 bytes): each is stored to the request mask `$05AD`
(`TARGET_REQUEST_MASK`, its bits are rules) by `alchemy_cast_action_direct_targeting` / `_area_targeting`. The consumables
store the same form (`$C4:5A84`). The words and who uses them: `docs/disassembly/engine-core/rom-enums.md` §9 (corrected
2026-11-25: the list here had byte-swapped values, e.g. Revive `$1400`, not `$0014`).
