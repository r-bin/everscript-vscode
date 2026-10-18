---
addr: 8FCD4D
kind: code
category: 🧠
name: entity_unfreeze_mobilize
title: Restore autonomous entity physics and clear immobilization status flags
confidence: confirmed
tags: [entities, physics, mobility, script-vm]
evidence: ["disasm: $8F:CD4D calls $8F:A8E2, clears status flags bits via AND #$DFDE (clearing bit 5 0x0020 and bit 13 0x2000), clears anim state via AND #$FCFF, zeroes latch timer at +$78, restores neutral frame via $8F:9937 if player/dog", "docs/disassembly/script-vm/opcode-mobility.md"]
see: [rom/8cdb11.md, rom/8fcd78.md, docs/disassembly/script-vm/opcode-mobility.md]
---
Re-enables autonomous physics, movement, and animation on an entity after an immobilization or cutscene freeze:
1. Calls `$8F:A8E2` to resume physics processing.
2. Clears status flags (`entity->status_flags &= ~0x2021`), clearing bit 5 (`0x0020` immobilized), bit 0 (`0x0001` dead/inactive), and bit 13 (`0x2000` script lock).
3. Clears animation transition bits (`entity->anim_state &= ~0x0300`).
4. Zeroes out the immobilization countdown latch timer at `+$78`.
5. If the entity is a player or companion (`address >= $4E89`), checks the auxiliary animation descriptor at `+$98` and calls `$8F:9937` to restore neutral standing frames.

Invoked directly by Script VM Opcode `0x2B` (`$8C:DB11`).

## Addresses
- Entity Physics Resume Routine: `$8F:A8E2`
- Neutral Animation Restore Routine: `$8F:9937`
- Entity Status Flags Field: `+$10`
- Entity Animation State Field: `+$12`
- Entity Latch Timer Field: `+$78`
- Script VM Opcode 0x2B Caller: `$8C:DB11`
