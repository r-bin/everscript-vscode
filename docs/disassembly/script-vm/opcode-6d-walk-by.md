# Script Opcode 0x6D: Walk Entity by Tile Offset

**Handler:** `$8C:DA2F`\
**Operands:** entity expression, `dx` expression, `dy` expression\
**Reachability:** 98 statically reachable instructions\
**Confidence:** confirmed

The handler clears DP `$12`, evaluates the entity, then evaluates `dx` and `dy` in that order. Each offset is shifted left four bits (tile-to-pixel scaling) and added, with 16-bit arithmetic, to the entity's current coordinates at `+$1A` and `+$1C`. It stores the resulting point at DP `$46`/`$48` and enters shared path logic `$8C:DAA6`. That routine skips path scheduling for a non-player entity below `$4E89` with zero HP at `+$2A`; otherwise it calls `$8F:AA82`. The opcode returns carry set.

The host-side model is [8CDA2F_opcode_6d_walk_by.c](../../../reconstructed-c/8C/8CDA2F_opcode_6d_walk_by.c). Pathfinding and movement scheduling remain delegated to `$8F:AA82`.

## Evidence

- Opcode table entry `$8C:E997` dispatches to `$8C:DA2F`.
- The handler shifts each evaluated offset left four times, adds the results to entity coordinates `+$1A`/`+$1C`, and jumps to `$8C:DAA6`.
- `$8C:DAA6` performs the same zero-HP non-player guard as opcode `0x6C` before invoking `$8F:AA82`.