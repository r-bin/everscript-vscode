---
addr: 8FCD78
size: 16
end: 8FCD87
kind: code
category: 🧠
name: entity_freeze_immobilize
title: Halt entity motion and set immobilized status flag
confidence: verified
tags: [entities, physics, immobilization, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: $8F:CD78 ldy $4C; jsl $8F98FE; lda $0010,y; ora #$0020; sta $0010,y; rtl\", \"docs/disassembly/script-vm/opcode-freeze.md\"]"
  - "Reconstructed in `reconstructed-c/8F/8FCD78_entity_freeze_immobilize.c` (SOE_BIND); passes Gate G1 differential verification (30/30 reference states, 0/0 fuzzed states, mutation caught: yes, 9 / 259 ROM/C instructions per call)."
see: [routines/script_op_freeze_entity.md, routines/script_op_2c_freeze_mask.md, routines/entity_unfreeze_mobilize.md, docs/disassembly/script-vm/opcode-freeze.md, docs/disassembly/script-vm/opcode-freeze.md]
---
Halts active physics/animation motion on the target entity (`$4C`) by calling `$8F:98FE`, and sets status flag bit 5 (`0x0020`) in `entity->status_flags` (`+$10`).

While bit 5 is asserted, player controller input is locked out, AI movement evaluations are bypassed, and physics position integration is skipped.
Used directly by script opcode `0x2A` (`$8C:DB67`) and opcode `0x2C` (`$8C:DB2A`) during cutscene sequences to lock characters in place.

## Addresses
- Target Entity Pointer: DP `$4C`
- Entity Motion Reset Routine: `$8F:98FE`
- Entity Status Flags Field: `+$10` (bit 5 `0x0020` = immobilized)
- Script Opcode 0x2A Caller: `$8C:DB67`
- Script Opcode 0x2C Caller: `$8C:DB2A`

