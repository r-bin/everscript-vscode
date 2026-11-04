---
addr: 8E8F50
size: 128
end: 8E8FCF
kind: code
category: 🧠
name: ring_menu_subitem_select
title: Ring Menu Sub-Item Ownership & Usability Check
confidence: confirmed
tags: [weapon, item]
evidence: ["disasm: $8E:8F50 shifts cursor index in $12, tests inventory ownership in $231D,x, sets rejection bit 0x0020 in $05A9 on failure, and falls through to equip handler on success"]
see: [routines/weapon_equip_and_experience_update.md, routines/ring_menu_select_and_cost_check.md, ui/weapon-select.md]
---
Validates selected weapon or item from the radial ring menu:
- Extracts inventory index from ring menu cursor slot in `$12`.
- Checks ownership byte at `$7E:231D,x`.
- If unowned, asserts rejection bit `0x0020` in `$7E:05A9` (triggering error buzzer) and aborts.
- On success, proceeds to weapon equip handler `$8E:9000`.
Full clean C decompilation: `docs/disassembly/ui/weapon-select.md`.
