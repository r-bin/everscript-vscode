---
addr: 7E1069
end: 7E106B
kind: pointer
name: ROOM_STEP_TRIGGER_TABLE_PTR
title: 24-bit far pointer to room step-on trigger table
lifetime: room
confidence: confirmed
tags: [room, trigger]
evidence: ["rea: 0x8fac84 loads $1069 into DP $26 and $106A into DP $27 (bank in $106B)", "reconstructed-c: 8FACB1_step_triggers.c", "doc: docs/disassembly/maps/step-triggers.md"]
see: [knowledge/wram/1067.md]
---
24-bit far pointer (`$1069` low word, `$106B` bank byte) referencing the active room's array of 6-byte step-on trigger bounding boxes:
- Each trigger entry is formatted as `[y1, x1, y2, x2, script_id:2]`.
- Loaded into Direct Page far pointer `<$26..<$28` by `func_8FAC84` before calling the spatial bounding box comparator `func_8FACCE`.

