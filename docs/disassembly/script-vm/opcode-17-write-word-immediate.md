# Script Opcode 0x17: Write an Immediate Save Word

**Routine:** `$8C:D79D`\
**Range:** `$8C:D79D`–`$8C:D7B2`\
**Confidence:** confirmed operand flow and write width

## Behavior

The handler reads a 16-bit offset followed by a 16-bit immediate value, then writes the value to `$7E:2258 + offset`. It returns carry set for same-turn continuation.

The host-side model is [8CD79D_opcode_17_write_word_immediate.c](../../../reconstructed-c/8C/8CD79D_opcode_17_write_word_immediate.c). It delegates both word fetches and the WRAM write to VM interfaces.

## Evidence

- Vanilla VFS at `$8C:D79D` adds the first word read through `[$82]` to `$2258`, advances the script pointer twice, then loads the next word as the value and advances twice again.
- The value is stored with `STA $0000,X`, followed by `SEC; RTS`.
- Opcode VFS entry `0x17` identifies operands `u16 u16` and handler `$8C:D79D`.