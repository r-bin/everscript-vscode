# Script Opcode 0x6C: Walk Entity to Tile

**Handler:** `$8C:DA67`\
**Operands:** entity expression, `u8` tile X, `u8` tile Y\
**Reachability:** 228 statically reachable instructions\
**Confidence:** confirmed

The handler clears DP `$12`, evaluates the entity through `$8C:EC8E`, reads unsigned X and Y bytes, scales each coordinate by eight, stores them in DP `$46` and `$48`, and jumps to the shared path routine `$8C:DAA6`. That routine skips the path request for a non-player entity below `$4E89` whose HP word at entity `+$2A` is zero; otherwise it calls `$8F:AA82` to queue movement to the destination. The opcode returns carry set, including the skipped-entity case.

The host-side model is [8CDA67_opcode_6c_walk_to_tile.c](../../../reconstructed-c/8C/8CDA67_opcode_6c_walk_to_tile.c). Pathfinding and movement scheduling remain delegated to `$8F:AA82`.

## Evidence

- Opcode table entry `$8C:E995` dispatches to `$8C:DA67`.
- `$8C:DA67` scales the operand bytes by 8 and stores them in DP `$46` and `$48` before jumping to `$8C:DAA6`.
- `$8C:DAA6` checks entity ID against `$4E89` and, for lower IDs, skips `$8F:AA82` when entity HP at `+$2A` is zero.