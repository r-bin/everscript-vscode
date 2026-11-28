---
addr: $7E:2348
name: AMMO_RESERVED_2348
type: u8
tags: [ammo]
confidence: verified
evidence: ["cdl", "disasm"]
---
Reserved ammo slot byte

## Correction (2026-11-28)
Read in the code as the current currency index (0, 3, 6, 9: talons, jewels, gold pieces, credits), not an ammunition
byte; ammunition counts are `$2345-$2347`. Not watched in an emulator. The entry's name is older.
