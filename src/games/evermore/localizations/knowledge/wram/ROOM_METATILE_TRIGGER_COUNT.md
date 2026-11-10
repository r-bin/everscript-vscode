---
addr: $7E:1062
name: ROOM_METATILE_TRIGGER_COUNT
type: u16
tags: [map, map.triggers]
confidence: verified
evidence: ["cdl", "disasm"]
---
Byte length of the room's step-on trigger table (6 bytes per record).

## Notes

Measured 2026-11-10 (recomp, room `0x51`): `$1062` = `$0036`, `$1064` = `$A9:AEE6`, whose first record
is the ROM's first step-on record; `$1067` = `$0096`, `$1069` = `$A9:AF1E`, the first B-trigger
record. So this is the **step-on** table, as `docs/map-format/room-reference.md` §10 says.
Previously believed: "Number of active metatile collision / terrain boundary triggers loaded for current room ($90:8EE2, $8F:B0B3).". The name is kept for now (soe_ram.h, references); a rename is open.
