# Script Opcodes 0x12 and 0x16: Write Argument Byte

**Routine:** `$8C:D7E6`\
**Range:** `$8C:D7E6`–`$8C:D81B`\
**Confidence:** confirmed handler flow and destination layout

## Behavior

Both opcode table entries (`$8C:E8E1` for `0x12` and `$8C:E8E9` for `0x16`) target `$8C:D7E6`. The handler derives a byte destination at `thread_slot + $0F + operand`, where the operand is one byte. The `$0F` slot offset is the start of the ten-word argument area. It evaluates an expression, stores the low byte at that destination through data bank `$7E`, restores 16-bit accumulator/index widths, and returns with carry set.

The handler increments the 24-bit script pointer while fetching its one-byte operand, including the bank-byte carry when the low word wraps. Expression evaluation may advance that pointer further; it is delegated to `$8C:EA43` in the host model.

The host-side model is [8CD7E6_opcode_12_16_write_arg_byte.c](../../../reconstructed-c/8C/8CD7E6_opcode_12_16_write_arg_byte.c). The thread-slot base is explicit input, and the existing VM helpers own stream fetch, expression evaluation, and DBR-relative storage.

## Evidence

- Vanilla VFS disassembly at `$8C:D7E6`–`$8C:D81B`: adds `$000F` to the active slot pointer, fetches a byte through `[$82]`, advances the 24-bit script pointer, evaluates an expression, and stores its low byte through DBR `$7E`.
- Opcode VFS entries for `0x12` and `0x16` both identify `$8C:D7E6` as their handler and a `u8` operand.
- [Script slot layout](soe://localization/knowledge/ram/7e28fc.md): the argument words begin at slot offset `+$0F`.