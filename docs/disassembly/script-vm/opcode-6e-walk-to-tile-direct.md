# Script Opcode 0x6E: Walk Entity to Tile Directly

**Handler:** `$8C:DA60`\
**Operands:** entity expression, `u8` tile X, `u8` tile Y\
**Reachability:** 522 statically reachable instructions\
**Confidence:** confirmed

The handler sets DP `$12` to `1` and enters the shared tile-coordinate decoder at `$8C:DA69`. That code evaluates the entity, reads unsigned X and Y bytes, scales each by eight, and enters shared path logic at `$8C:DAA6`. Dead non-player entities below `$4E89` are skipped. For other entities, nonzero mode dispatches to `$8F:AAD3` rather than terrain-aware `$8F:AA82`; the direct mover avoids elevation lookup and sets movement-record flags `$0230`. The opcode returns carry set.

The host-side model is [8CDA60_opcode_6e_walk_to_tile_direct.c](../../../reconstructed-c/8C/8CDA60_opcode_6e_walk_to_tile_direct.c). Direct movement scheduling remains delegated to `$8F:AAD3`.

## Evidence

- Opcode table entry `$8C:E999` dispatches to `$8C:DA60`.
- `$8C:DA60` sets `$12 = 1` before branching to `$8C:DA69`, the shared coordinate decoder.
- `$8C:DAA6` skips dead non-player entities; its `$12 != 0` path calls `$8F:AAD3`.
- `$8F:AAD3` prepares a direct move and ORs `$0230` into the movement record flags.