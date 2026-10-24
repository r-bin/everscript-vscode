# Script Opcode 0x73: Walk Entity to Point Directly

**Handler:** `$8C:DA8D`\
**Operands:** entity expression, pixel X expression, pixel Y expression\
**Reachability:** 155 statically reachable instructions\
**Confidence:** confirmed

The handler places direct-movement mode `1` on the stack, evaluates the entity and absolute pixel X/Y expressions into DP `$46`/`$48`, restores the mode to DP `$12`, and enters shared logic `$8C:DAA6`. That routine skips dead non-player entities below `$4E89`; otherwise the direct mode calls `$8F:AAD3` rather than terrain-aware pathfinding `$8F:AA82`. Unlike opcodes `0x6E` and `0x6F`, the coordinates are already pixels and are not scaled. The opcode returns carry set.

The host-side model is [8CDA8D_opcode_73_walk_to_direct.c](../../../reconstructed-c/8C/8CDA8D_opcode_73_walk_to_direct.c). Direct movement scheduling remains delegated to `$8F:AAD3`.

## Evidence

- Opcode table entry `$8C:E9A3` dispatches to `$8C:DA8D`.
- The handler pushes mode `1`, evaluates entity/X/Y, stores X/Y in DP `$46`/`$48`, restores the mode into `$12`, then jumps to `$8C:DAA6`.
- `$8C:DAA6` skips dead non-player entities and dispatches nonzero mode to `$8F:AAD3`.