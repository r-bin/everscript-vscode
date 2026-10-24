# Script Opcodes 0x19 and 0x1D: Write a Temporary Word

**Routine:** `$8C:D7CC`\
**Range:** `$8C:D7CC`–`$8C:D7E5`\
**Confidence:** confirmed operand flow and write width

## Behavior

Both opcodes read a 16-bit offset, evaluate one expression, and write its 16-bit result to `$7E:2834 + offset`. The handler returns carry set for same-turn continuation. The opcode table entries `$8C:E8EF` (`0x19`) and `$8C:E8F7` (`0x1D`) share this routine.

The host-side model is [8CD7CC_opcode_19_1d_write_temp_word.c](../../../reconstructed-c/8C/8CD7CC_opcode_19_1d_write_temp_word.c). It delegates the offset fetch, expression evaluation, and WRAM write to VM interfaces.

## Evidence

- Vanilla VFS at `$8C:D7CC` loads `$2834` and branches to `$8C:D7D4`.
- The shared tail adds the 16-bit offset read through `[$82]`, advances the script pointer twice, evaluates an expression, stores the resulting word, and returns with `SEC; RTS`.
- Opcode VFS entries `0x19` and `0x1D` both identify `$8C:D7CC` with operands `u16 E`.