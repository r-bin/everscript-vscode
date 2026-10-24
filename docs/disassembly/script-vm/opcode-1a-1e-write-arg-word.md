# Script Opcodes 0x1A and 0x1E: Write a Script Argument Word

**Routine:** `$8C:D7B3`\
**Range:** `$8C:D7B3`–`$8C:D7CB`\
**Confidence:** confirmed operand flow and write width

## Behavior

Both opcodes fetch an 8-bit byte offset, evaluate one expression, and write the 16-bit result to the active thread slot at `slot + $0F + byte_offset`. The argument area begins at slot offset `+$0F`; the operand is a byte offset, not a word index. The handler returns carry set for same-turn continuation. Opcode entries `$8C:E8F1` (`0x1A`) and `$8C:E8F9` (`0x1E`) share this routine.

The host-side model is [8CD7B3_opcode_1a_1e_write_arg_word.c](../../../reconstructed-c/8C/8CD7B3_opcode_1a_1e_write_arg_word.c). It receives the active slot base explicitly and delegates operand fetch, expression evaluation, and DBR-relative word writing to VM interfaces.

## Evidence

- Vanilla VFS at `$8C:D7B3` loads the active thread-slot base from DP `$7E`, adds `$000F`, then adds the fetched 8-bit offset.
- The handler evaluates the expression and stores the resulting word at the computed slot-relative address before returning with `SEC; RTS`.
- Opcode VFS entries `0x1A` and `0x1E` both identify `$8C:D7B3` with operands `u8 E`.
- [Script slot layout](soe://localization/knowledge/ram/7e28fc.md) documents the ten argument words beginning at slot offset `+$0F`.