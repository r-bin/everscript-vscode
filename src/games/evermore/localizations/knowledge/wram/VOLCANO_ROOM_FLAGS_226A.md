---
addr: 7E226A
size: 1
kind: flags
name: VOLCANO_ROOM_FLAGS_226A
title: Volcano room-script progress and event bitmask (pipe-maze side rooms 0x3E and Volcano path 0x69)
lifetime: save
confidence: likely
tags: [map.volcano, room, flags]
evidence: ["evs: the audit finds masked reads/writes in rooms 0x3E and 0x69, with masks 0x01 through 0x80 represented across the inventory", "disasm: generic save-flag handlers map flag IDs through $7E:2258, placing this byte in the documented save-persistent story/room flag area"]
see: [docs/scripts/unnamed-memory-audit.md, knowledge/wram/ALCHEMY_KNOWN_FLAGS.md, routines/script_op_0c_set_flag.md]
---
One save-persistent byte tested by scripts in two Volcano rooms. It behaves as a bitfield managing progression, door states, and event triggers across the volcano sub-areas. The name describes the observed room grouping, not proven exclusive ownership by those rooms.

## Bits
| mask | meaning |
|---|---|
| `0x01`–`0x80` | Bitmask across scripts in rooms `0x3E` (Volcano pipe-maze side rooms) and `0x69` (Volcano path) governing room progression events. |

## Notes
No address-specific ROM reader/writer has been confirmed. The save lifetime is inferred from the generic save-flag mapping and the documented save-flag region, not from an address-specific save/load trace.