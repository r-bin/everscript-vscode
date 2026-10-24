# Script Opcode 0x0B: Jump If Currency Is Below

**Routine:** `$8C:D4D0`\
**Range:** `$8C:D4D0`–`$8C:D500`\
**Confidence:** confirmed comparison and operand flow

## Behavior

The handler evaluates an expression to obtain the currency offset, then reads a 24-bit threshold from the script stream (16-bit low word followed by one high byte). It reads the three-byte balance beginning at `$7E:0AC6 + offset` and compares the balance with the threshold as unsigned 24-bit values.

When the balance is below the threshold, the handler transfers to `$8C:D434`, which reads and applies the relative 16-bit branch displacement. Otherwise it advances the script pointer by two bytes to skip that displacement. Both paths return carry set so the current thread continues in the same turn.

The host-side model is [8CD4D0_opcode_0b_jump_if_currency_below.c](../../../reconstructed-c/8C/8CD4D0_opcode_0b_jump_if_currency_below.c). It delegates currency bus reads, script stream fetches, and the taken relative jump to VM interfaces.

## Evidence

- Vanilla VFS disassembly at `$8C:D4D0`–`$8C:D500`: evaluates the currency offset, reads the 16-bit and 8-bit threshold parts, subtracts them from the three-byte balance with borrow propagation, and tests the signed result.
- A negative result jumps to `$8C:D434`; otherwise execution reaches `$8C:D4FB`, which advances DP `$82` twice before `SEC; RTS`.
- Opcode VFS entry `0x0B` identifies operands `E u16 u8 r16` and handler `$8C:D4D0`.