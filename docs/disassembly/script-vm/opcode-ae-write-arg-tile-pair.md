# Script Opcode 0xAE: Write a Tile Pair to Argument Words

**Handler entry:** `$8C:D71F`\
**Shared writer:** `$8C:D781`\
**Opcode table entry:** `$8C:EA19`\
**Operands:** two byte offsets, then two tile-coordinate bytes\
**Confidence:** operand reads, destination arithmetic, scaling, and continuation confirmed

## Control Flow

For each destination, the handler adds the byte offset and `$000F` to the 16-bit value
read from DP `$7E`. It then reads the corresponding tile-coordinate byte, multiplies it
by eight, and stores the pixel coordinate through X or Y. It returns carry set.

The caller's DP `$7E` value is passed explicitly to the C model as `argument_base`; its
meaning in the surrounding call-frame machinery is not inferred here.

The model is
[`reconstructed-c/8C/8CD71F_opcode_ae_write_arg_tile_pair.c`](../../../reconstructed-c/8C/8CD71F_opcode_ae_write_arg_tile_pair.c).

## Evidence

- `$8C:D71F` loads DP `$7E`, adds `$000F`, then adds the first byte operand and forms X.
- `$8C:D737` repeats that calculation for the second byte operand and forms Y.
- `$8C:D781` and `$8C:D78E` read each coordinate byte, multiply it by eight, and store
  through X and Y.
- `$8C:D79B` sets carry before returning.