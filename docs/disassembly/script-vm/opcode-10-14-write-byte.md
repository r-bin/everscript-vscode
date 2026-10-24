# Script Opcodes 0x10 and 0x14: Write a Save Byte

**Routine:** `$8C:D804`\
**Range:** `$8C:D804`–`$8C:D81B`\
**Confidence:** confirmed operand flow and write width

## Behavior

Both opcodes read a 16-bit offset, evaluate one expression, and write its low byte to `$7E:2258 + offset`. The handler returns carry set for same-turn continuation. The opcode table entries `$8C:E8DD` (`0x10`) and `$8C:E8E5` (`0x14`) share this routine.

The host-side model is [8CD804_opcode_10_14_write_byte.c](../../../reconstructed-c/8C/8CD804_opcode_10_14_write_byte.c). It delegates script-stream reads, expression evaluation, and WRAM writes to VM interfaces.

## Evidence

- Vanilla VFS at `$8C:D804` loads `$2258`, adds the word operand through `[$82]`, and advances the script pointer twice.
- The routine evaluates an expression, narrows the accumulator to 8 bits, stores to the computed address, restores 16-bit widths, and returns.
- Opcode VFS entries `0x10` and `0x14` both identify `$8C:D804` with operands `u16 E`.