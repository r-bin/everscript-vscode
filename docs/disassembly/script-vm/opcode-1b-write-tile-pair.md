# Script Opcode 0x1B: Write a Tile Coordinate Pair

**Routine:** `$8C:D76B`\
**Range:** `$8C:D76B`–`$8C:D79C`\
**Confidence:** confirmed operand flow and coordinate scaling

## Behavior

The handler reads two 16-bit offsets into the save area at `$7E:2258`, followed by an 8-bit X tile coordinate and an 8-bit Y tile coordinate. It multiplies each coordinate by eight and writes each result as a word at its corresponding offset. It returns carry set for same-turn continuation.

The host-side model is [8CD76B_opcode_1b_write_tile_pair.c](../../../reconstructed-c/8C/8CD76B_opcode_1b_write_tile_pair.c). It delegates operand fetches and WRAM writes to VM interfaces.

## Evidence

- Vanilla VFS at `$8C:D76B` adds the first `u16` operand to `$2258` and saves the destination in X; it repeats this for the second `u16` destination in Y.
- The next byte is masked to 8 bits, shifted left three times, and stored as a word at the first destination. The following byte is handled identically for the second destination.
- The handler ends with `SEC; RTS`; opcode VFS entry `0x1B` lists operands `u16 u16 u8 u8`.