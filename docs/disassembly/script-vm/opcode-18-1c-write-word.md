# Script Opcodes 0x18 and 0x1C: Write a Save Word

**Routine:** `$8C:D7D1`\
**Range:** `$8C:D7D1`–`$8C:D7E5`\
**Confidence:** confirmed operand flow and write width

## Behavior

Both opcodes read a 16-bit offset, evaluate one expression, and write its 16-bit result to `$7E:2258 + offset`. The handler returns carry set for same-turn continuation. The opcode table entries `$8C:E8ED` (`0x18`) and `$8C:E8F5` (`0x1C`) share this routine.

The host-side model is [8CD7D1_opcode_18_1c_write_word.c](../../../reconstructed-c/8C/8CD7D1_opcode_18_1c_write_word.c). It delegates the offset fetch, expression evaluation, and WRAM write to VM interfaces.

## Evidence

- Vanilla VFS at `$8C:D7D1` adds the word operand read through `[$82]` to `$2258` and advances the script pointer twice.
- It preserves the destination, evaluates an expression, stores the resulting word, and returns with `SEC; RTS`.
- Opcode VFS entries `0x18` and `0x1C` both identify `$8C:D7D1` with operands `u16 E`.