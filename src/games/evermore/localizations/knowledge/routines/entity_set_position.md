---
addr: 8FC2D1
size: 19
end: 8FC2E3
kind: code
category: 🧠
name: entity_set_position
title: Teleport entity to world coordinates and update tile collision attributes
confidence: verified
tags: [entities, physics, coordinates, collision, script-vm, reconstructed-c, g1-pass]
evidence: "[\"disasm: $8F:C2D1 preserves elevation Z from +$18 into DP $44, projects room boundaries via $90:9815, adjusts elevation via $8FA914, and falls into $8F:C2E4 to calculate tile offset via hardware multiplier $004202 and refresh child entity attachments\", \"docs/disassembly/entities/entity-position.md\"]; G1 pass (42/42 reference states, 0/0 fuzzed states, mutation caught)"
see: [routines/entity_set_position_with_z.md, routines/script_op_43_teleport.md, docs/disassembly/entities/entity-position.md]
---
Updates an entity's 2D world position while preserving and projecting its current Z elevation:
1. Reads current Z elevation from `entity->z` (`+$18`) into DP `$44`.
2. Clamps target coordinates (DP `$46`, `$48`) against room boundary thresholds via `$90:9815`.
3. Adjusts elevation for multi-layer ramps via `$8F:A914`.
4. Enters `$8F:C2E4` to set coordinates, calculate 16x16 tile offsets via SNES hardware multiplier registers `$004202` / `$004216`, read terrain surface flags from `$7F:0004`, and recursively update attached child entities (shadows, weapons, barrier shields).

Invoked by Script VM Opcode `0x43` (`$8C:E00D`) when no explicit Z elevation override is present.

## Addresses
- Entity Pointer: DP `$4C`
- Entity Elevation Field: `+$18`
- Coordinate Boundary Clamp: `$90:9815`
- Elevation Layer Projection: `$8F:A914`
- Full Position Setter: `$8F:C2E4`
- Script Opcode 0x43 Caller: `$8C:E00D`
