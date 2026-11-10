---
addr: 7E1067
end: 7E1068
kind: var
name: ROOM_STEP_TRIGGER_COUNT
title: Byte length of the room's B-trigger table (6 bytes per record)
lifetime: room
confidence: confirmed
tags: [room, trigger, map.triggers]
evidence: ["rea: 0x8fac84 loads count from $1067 into DP $12 for trigger search", "reconstructed-c: 8FACB1_step_triggers.c scans g_trigger_count entries", "doc: docs/disassembly/maps/step-triggers.md"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-bit word indicating the number of step-on coordinate triggers loaded for the active room.
- Loaded into Direct Page `<$12` by `func_8FAC84` during player movement evaluation.
- If zero, trigger scanning is bypassed immediately.
- Corresponds to the entry count of the trigger table pointed to by `$7E:1069`.

## Notes

Measured 2026-11-10 (recomp, room `0x51`): `$1062` = `$0036`, `$1064` = `$A9:AEE6`, whose first record
is the ROM's first step-on record; `$1067` = `$0096`, `$1069` = `$A9:AF1E`, the first B-trigger
record. So this is the **B-trigger** table, as `docs/map-format/room-reference.md` §10 says.
Previously believed: "Count of active step-on coordinate triggers in room". The name is kept for now (soe_ram.h, references); a rename is open.
