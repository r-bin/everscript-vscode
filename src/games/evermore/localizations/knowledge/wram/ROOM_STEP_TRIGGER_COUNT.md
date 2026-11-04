---
addr: 7E1067
end: 7E1068
kind: var
name: ROOM_STEP_TRIGGER_COUNT
title: Count of active step-on coordinate triggers in room
lifetime: room
confidence: confirmed
tags: [room, trigger]
evidence: ["rea: 0x8fac84 loads count from $1067 into DP $12 for trigger search", "reconstructed-c: 8FACB1_step_triggers.c scans g_trigger_count entries", "doc: docs/disassembly/maps/step-triggers.md"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-bit word indicating the number of step-on coordinate triggers loaded for the active room.
- Loaded into Direct Page `<$12` by `func_8FAC84` during player movement evaluation.
- If zero, trigger scanning is bypassed immediately.
- Corresponds to the entry count of the trigger table pointed to by `$7E:1069`.

