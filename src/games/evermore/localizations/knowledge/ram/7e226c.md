---
addr: 7E226C
size: 1
kind: flags
name: QUICKSAND_FIELD_PICKUP_CLAIM_FLAGS
title: Quicksand Field pickup-claimed flags
lifetime: save
confidence: likely
tags: [map.quicksand_field, loot, flags]
evidence: ["evs: B-triggers in rooms 0x59 and 0x5A test and set all eight bits as pickup claims; matching enter-script object-state operands use flag IDs 0xA0–0xA7", "disasm: generic save-flag handler maps IDs 0xA0–0xA7 to $7E:226C bits 0–7", "disasm: opcode 0x0C writes computed save flags; the loot handler reports success through $7E:22EA bit 0"]
see: [docs/scripts/unnamed-memory-audit.md, docs/scripts/vm.md, ram/7e2258.md, ram/7e22ea.md, rom/8cd83e.md]
---
One save-persistent byte whose bits record pickup claims in Quicksand Field room scripts. The triggers test each bit before offering the reward and set it from the loot-success result, while enter scripts use the matching save-flag IDs to restore object state.

## Bits
| mask | flag ID | observed role |
|---|---:|---|
| `0x01` | `0xA0` | Room `0x59`, B-trigger 26: Petal pickup. |
| `0x02` | `0xA1` | Room `0x59`, B-trigger 27: Wax pickup. |
| `0x04` | `0xA2` | Room `0x59`, B-trigger 4: Crystal pickup. |
| `0x08` | `0xA3` | Room `0x59`, B-trigger 25: Clay pickup. |
| `0x10` | `0xA4` | Room `0x59`, B-trigger 24: Biscuit pickup. |
| `0x20` | `0xA5` | Room `0x59`, B-trigger 22: Clay pickup. |
| `0x40` | `0xA6` | Room `0x59`, B-trigger 23: Water pickup. |
| `0x80` | `0xA7` | Room `0x5A`, B-trigger 1: Water pickup. |

## Notes
The room-script audit found these uses only in rooms `0x59` and `0x5A`; indirect or non-room-script uses are not ruled out. The observed `MAP_REF` and `NEXT_ADD` values are script parameters whose independent meanings remain unresolved.