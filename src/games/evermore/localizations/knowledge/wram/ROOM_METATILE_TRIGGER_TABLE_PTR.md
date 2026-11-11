---
addr: $7E:1064
name: ROOM_METATILE_TRIGGER_TABLE_PTR
type: u24
tags: [map, map.triggers]
confidence: verified
evidence: ["cdl", "disasm"]
---
24-bit pointer to the room's step-on trigger table in ROM.

## Notes

Measured 2026-11-10 (recomp, room `0x51`): `$1062` = `$0036`, `$1064` = `$A9:AEE6`, whose first record
is the ROM's first step-on record; `$1067` = `$0096`, `$1069` = `$A9:AF1E`, the first B-trigger
record. So this is the **step-on** table, as `docs/map-format/room-reference.md` §10 says.
Previously believed: "24-bit far pointer to active room metatile boundary trigger definitions in ROM ($7E:1064..$7E:1066; $90:8EE2).". The name is kept for now (soe_ram.h, references); a rename is open.
