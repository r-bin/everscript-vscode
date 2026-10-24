# Script Opcode 0x62: Start Tile Animation

**Handler:** `$8C:DFCF`\
**Operands:** `u8` channel key, `u16` parameter A, `u16` parameter B\
**Reachability:** 70 statically reachable instructions\
**Confidence:** confirmed

The handler reads the channel key and stores it in direct-page `$06`, then reads two words into `$0A` and `$0C`. It calls `$90:A2A2`, which searches the room's tile-animation channels using the key and activates the matching channel with the two parameters. The opcode returns carry set.

The host-side wrapper is [8CDFCF_opcode_62_tile_animate.c](../../../reconstructed-c/8C/8CDFCF_opcode_62_tile_animate.c). Channel search and activation remain delegated to the map-animation helper.

## Evidence

- Opcode table entry `$8C:E981` dispatches to `$8C:DFCF`.
- `$8C:DFCF` reads operands in byte, word, word order; stores them at DP `$06`, `$0A`, and `$0C`; calls `$90:A2A2`; then executes `SEC; RTS`.
- `$90:A2A2` is the room tile-animation channel search and activator.