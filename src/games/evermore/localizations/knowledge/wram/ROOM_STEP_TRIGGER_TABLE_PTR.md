---
addr: 7E1069
end: 7E106B
kind: pointer
name: ROOM_STEP_TRIGGER_TABLE_PTR
title: 24-bit pointer to the room's B-trigger table in ROM
lifetime: room
confidence: confirmed
tags: [room, trigger, map.triggers]
evidence: ["rea: 0x8fac84 loads $1069 into DP $26 and $106A into DP $27 (bank in $106B)", "reconstructed-c: 8FACB1_step_triggers.c", "doc: docs/disassembly/maps/step-triggers.md"]
see: [knowledge/wram/ROOM_STEP_TRIGGER_COUNT.md]
---
24-bit far pointer (`$1069` low word, `$106B` bank byte) referencing the active room's array of 6-byte step-on trigger bounding boxes:
- Each trigger entry is formatted as `[y1, x1, y2, x2, script_id:2]`.
- Loaded into Direct Page far pointer `<$26..<$28` by `func_8FAC84` before calling the spatial bounding box comparator `func_8FACCE`.

## Notes

Measured 2026-11-10 (recomp, room `0x51`): `$1062` = `$0036`, `$1064` = `$A9:AEE6`, whose first record
is the ROM's first step-on record; `$1067` = `$0096`, `$1069` = `$A9:AF1E`, the first B-trigger
record. So this is the **B-trigger** table, as `docs/map-format/room-reference.md` §10 says.
Previously believed: "24-bit far pointer to room step-on trigger table". The name is kept for now (soe_ram.h, references); a rename is open.
