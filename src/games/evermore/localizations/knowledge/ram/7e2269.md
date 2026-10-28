---
addr: 7E2269
size: 1
kind: flags
name: PERSISTENT_ROOM_EVENT_FLAGS_2269
title: Persistent room-event flags (partially identified)
lifetime: save
confidence: likely
tags: [room, flags, loot]
evidence: ["test: room 0x25 bit 4 is the wax-gourd pickup flag; its B-trigger sets the flag and the simulation checks the matching permanent object state", "evs: raw bit tests/writes occur in rooms 0x25, 0x38, and 0x69; the full address inventory records all eight masks", "disasm: the script save-flag handlers map IDs through the save-flag base at $7E:2258; $7E:2269 is within the documented save-persistent story/room flag area"]
see: [docs/scripts/unnamed-memory-audit.md, ram/7e2258.md, rom/8cd83e.md]
---
One save-persistent byte used by room scripts as independent flags. One bit is identified as a permanent pickup claim; the remaining observed bits have not been mapped to specific events. The address and byte width follow the generic save-flag mapping, while the event name is a conservative grouping rather than a complete field definition.

## Bits
| bit | meaning |
|---|---|
| `0x10` | Room `0x25`, object 0: wax-gourd pickup claimed. The trigger stores the successful-pickup result in this bit; the room's object-state flag hides the pickup afterward. |
| other observed bits | Used by room scripts in rooms `0x25`, `0x38`, and/or `0x69`; individual event meanings are unresolved. |

## Notes
The audit observes all eight masks across the address's room-script uses, but does not allocate every mask to a room. No address-specific engine accessor or full save/load trace has been established; generic flag handlers can access the byte through a computed flag ID.