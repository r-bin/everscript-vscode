# Script Opcode 0xAD: Write a Tile Pair to Temporary Words

**Handler entry:** `$8C:D752`\
**Shared writer:** `$8C:D781`\
**Opcode table entry:** `$8C:EA17`\
**Operands:** two little-endian word offsets, then two tile-coordinate bytes\
**Confidence:** operand reads, destination calculation, scaling, and continuation confirmed

## Control Flow

The handler adds each of the first two word operands to `$2834`, placing the results in
X and Y. The shared writer reads one byte for each tile coordinate, masks it to `$00FF`,
shifts it left three times, and stores the resulting pixel coordinate at `$0000,X` and
`$0000,Y`. It returns carry set, continuing the script in the same turn.

The byte reads use 16-bit `LDA [$82]` followed by a one-byte pointer increment and an
`AND #$00FF`; only the low byte is used, and the cursor advances by one per tile value.

The model is
[`reconstructed-c/8C/8CD752_opcode_ad_write_temp_tile_pair.c`](../../../reconstructed-c/8C/8CD752_opcode_ad_write_temp_tile_pair.c).

## Evidence

- `$8C:D752` and `$8C:D75D` add the first and second word operands to `$2834`; each
  advances DP `$82` twice.
- `$8C:D781` reads a byte, increments DP `$82` once, masks to `$00FF`, shifts left three
  times, and stores through X.
- `$8C:D78E` repeats the byte read and scaling for Y; `$8C:D79B` sets carry and returns.