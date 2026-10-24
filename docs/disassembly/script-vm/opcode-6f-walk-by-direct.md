# Script Opcode 0x6F: Walk Entity by Offset Directly

**Handler:** `$8C:DA28`\
**Operands:** entity expression, `dx` expression, `dy` expression\
**Reachability:** 704 statically reachable instructions\
**Confidence:** confirmed

The handler sets DP `$12` to `1` and branches into the shared relative-coordinate decoder at `$8C:DA31`. The decoder evaluates the entity and two offsets, scales each offset by 16, and adds them with 16-bit arithmetic to entity coordinates at `+$1A` and `+$1C`. Shared logic `$8C:DAA6` skips dead non-player entities below `$4E89`; otherwise nonzero mode dispatches to direct mover `$8F:AAD3` instead of terrain-aware pathfinding `$8F:AA82`. The opcode returns carry set.

The host-side model is [8CDA28_opcode_6f_walk_by_direct.c](../../../reconstructed-c/8C/8CDA28_opcode_6f_walk_by_direct.c). Direct movement scheduling remains delegated to `$8F:AAD3`.

## Evidence

- Opcode table entry `$8C:E99B` dispatches to `$8C:DA28`.
- `$8C:DA28` sets `$12 = 1` and branches to `$8C:DA31`, shared with opcode `0x6D`.
- `$8C:DAA6` checks for dead non-player entities; the `$12 != 0` path calls `$8F:AAD3`.
- `$8F:AAD3` prepares direct movement and sets movement-record flags `$0230`.