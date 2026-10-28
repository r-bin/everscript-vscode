---
addr: 7E226B
size: 1
kind: flags
name: CRUSTACIA_PICKUP_CLAIM_FLAGS
title: Crustacia pickup-claimed flags
lifetime: save
confidence: likely
tags: [map.crustacia, loot, flags]
evidence: ["evs: B-triggers in rooms 0x30 and 0x4F test and set all eight bits as pickup/chest claims, and matching enter-script object-state flags use IDs 0x98–0x9F", "disasm: generic save-flag handlers map IDs 0x98–0x9F to $7E:226B bits 0–7", "disasm: opcode 0x0C writes computed save flags and opcode 0x5D applies object state from save flags"]
see: [docs/scripts/unnamed-memory-audit.md, docs/scripts/vm.md, ram/7e2258.md, rom/8cd83e.md]
---
One save-persistent byte whose eight bits are used as independent pickup-claimed flags in rooms `0x30` and `0x4F`. A trigger tests the corresponding bit before awarding a pickup and records the successful-pickup result in it; room-enter scripts use the same save-flag IDs to restore the matching object's state.

## Bits
| mask | flag ID | observed role |
|---|---:|---|
| `0x01` | `0x98` | Room `0x4F`, object `0x0F`: Call Beads chest. |
| `0x02` | `0x99` | Room `0x4F`, object `0x10`: money chest. |
| `0x04` | `0x9A` | Room `0x30`, object 3: Water pickup. |
| `0x08` | `0x9B` | Room `0x30`, object 1: Clay pickup. |
| `0x10` | `0x9C` | Room `0x30`, object 6: Wax pickup. |
| `0x20` | `0x9D` | Room `0x30`, object 5: Water pickup. |
| `0x40` | `0x9E` | Room `0x30`, object 4: Nectar pickup. |
| `0x80` | `0x9F` | Room `0x30`, object 2: Nectar pickup. |

## Notes
The engine reaches this byte through the generic flag-ID mapping, not a confirmed hard-coded `$226B` accessor. The audit covers room scripts; other script or indirect save/load users have not been ruled out.