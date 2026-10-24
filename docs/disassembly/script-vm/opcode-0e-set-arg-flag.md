# Script Opcode 0x0E: Set or Clear an Argument Flag

**Routine:** `$8C:D81C`\
**Range:** `$8C:D81C`–`$8C:D869`\
**Confidence:** confirmed handler flow and bit update

## Behavior

The handler reads an 8-bit bit index from the script stream and evaluates one expression. The argument byte offset is `bit_index >> 3`, and the bit within that byte is `bit_index & 7`. The destination starts at the active thread slot's `+$0F` argument area.

For a nonzero expression, the handler ORs the selected bit into the destination byte. For zero, it ANDs the byte with the selected bit's complement. The two mask tables at `$80:A87F` and `$80:A887` provide the set and clear masks respectively. It then restores 16-bit accumulator/index widths and returns carry set.

The host-side model is [8CD81C_opcode_0e_set_arg_flag.c](../../../reconstructed-c/8C/8CD81C_opcode_0e_set_arg_flag.c). It receives the argument-byte base explicitly and delegates operand fetch and expression evaluation to the VM helpers.

## Evidence

- Vanilla VFS disassembly at `$8C:D81C`–`$8C:D869`: fetches the bit index through `[$82]`, advances the 24-bit script pointer, derives the byte offset with `AND #$00F8; LSR` repeated three times, and adds `$000F` to the thread slot base.
- The nonzero expression path loads the mask from `$80:A87F,X` and ORs it with the selected argument byte. The zero path loads the mask from `$80:A887,X` and ANDs it with that byte.
- Both paths converge at `REP #$20; SEC; RTS`.
- [Script slot layout](soe://localization/knowledge/ram/7e28fc.md): argument bytes begin at slot offset `+$0F`.