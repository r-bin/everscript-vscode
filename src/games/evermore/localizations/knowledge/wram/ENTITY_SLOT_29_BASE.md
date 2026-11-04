---
addr: 7E4DFB
end: 7E4E88
size: 142
kind: struct
name: ENTITY_SLOT_29_BASE
title: Runtime entity record for entity pool slot 29 ($7E:4DFB..$7E:4E88)
lifetime: room
confidence: confirmed
tags: [entity, pool]
evidence: ["disasm: 30-slot entity array at $7E:3DE5 + slot * 0x8E; slot 29 begins at $7E:4DFB and ends before Boy at $7E:4E89", "code: platform/cdl/tables.ts and lookup.ts reference slot 29 offsets ($7E:4E00 anim timer, $7E:4E57 last attacker, $7E:4E70 pending damage)"]
see: [knowledge/wram/ENTITY_DYNAMIC_POOL.md, knowledge/wram/ENTITY_PLAYER_BOY.md]
---
142-byte runtime entity record for slot 29 in the active entity pool (`$7E:4DFB`..`$7E:4E88`).
Precedes the Boy player character record at `$7E:4E89`. Contains all standard actor instance fields (position, facing, HP, stamina, collision, attacker links).
