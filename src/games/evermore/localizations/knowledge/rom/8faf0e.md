---
addr: 8FAF0E
end: 8FAF17
kind: code
category: 🧠
name: collision_step_success_commit
title: Commit successful physics movement step flag
confidence: confirmed
tags: [physics, collision, commit, entity]
evidence: ["disasm: sets step success bit 0 in entity status word $0012,Y (ORA #$0001) and executes RTL", "trace: executed at the end of successful movement steps in bank $8F", "c: G1 passed (tools/c-to-rom/g1.mts, v0.351.0): the bound C equals the ROM on 45 entry states sampled from the 2:20 no-input reference and 715 fuzzed ones; snes9x agrees with the interpreter on 45; a mutation is caught"]
see: [docs/disassembly/maps/conveyor-physics.md, rom/8fae46.md]
---
Commits a successful entity movement step. Sets bit 0 (`0x0001`) in `entity->reaction_flags_12` (`+$12,Y`), signaling to
the caller that the actor has completed displacement along the terrain without being completely obstructed.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/conveyor-physics.md`.
