---
addr: 7E226D
size: 1
kind: flags
name: PICKUP_CLAIM_FLAGS_226D
title: Pickup-claimed flags (rooms 0x35, 0x3B, 0x5A)
lifetime: save
confidence: likely
tags: [loot, flags]
evidence: ["evs: B-triggers in rooms 0x35, 0x3B, and 0x5A test/set all eight bits as pickup claims; matching enter-script object-state operands use flag IDs 0xA8–0xAF", "disasm: generic save-flag handlers map IDs 0xA8–0xAF to $7E:226D bits 0–7", "disasm: opcode 0x0C writes computed save flags and opcode 0x5D applies object state from save flags"]
see: [docs/scripts/unnamed-memory-audit.md, docs/scripts/vm.md, ram/7e2258.md, rom/8cd83e.md]
---
One save-persistent byte whose eight bits record pickup claims in rooms `0x35`, `0x3B`, and `0x5A`. Each observed trigger checks its bit before the reward and sets it from the loot-success result; the rooms' enter scripts use the corresponding save-flag IDs to restore the matching pickup object's state.

## Bits
| mask | flag ID | observed role |
|---|---:|---|
| `0x01` | `0xA8` | Room `0x5A`, B-trigger 0: Acid Rain giver, 4 Ash. |
| `0x02` | `0xA9` | Room `0x35`, B-trigger 5: Water pickup. |
| `0x04` | `0xAA` | Room `0x35`, B-trigger 6: Clay pickup. |
| `0x08` | `0xAB` | Room `0x35`, B-trigger 4: Water pickup. |
| `0x10` | `0xAC` | Room `0x35`, B-trigger 7: Water pickup. |
| `0x20` | `0xAD` | Room `0x35`, B-trigger 8: Water pickup. |
| `0x40` | `0xAE` | Room `0x35`, B-trigger 9: Clay pickup. |
| `0x80` | `0xAF` | Room `0x3B`, B-trigger 0/1: Mud Pepper pickup. |

## Notes
Flag IDs `0xA8–0xAF` map to this byte by the generic save-flag rule. The current evidence establishes the listed room-script behavior, not exclusive ownership: other scripts and indirect save/load accesses may also use these IDs. A CDL DMA write was observed for the address, but its source and purpose are unresolved and are not used to assign this name.