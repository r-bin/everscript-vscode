# Script Opcode 0x0A: Jump If Currency Is At Least

**Routine:** `$8C:D491`\
**Range:** `$8C:D491`–`$8C:D4C1`\
**Confidence:** confirmed comparison and operand flow

## Behavior

The handler evaluates an expression to obtain the currency offset, then reads a 24-bit threshold from the script stream (16-bit low word followed by one high byte). It reads the three-byte balance beginning at `$7E:0AC6 + offset` and compares the balance with the threshold as unsigned 24-bit values.

When the balance is at least the threshold, the handler transfers to `$8C:D434`, which reads and applies the relative 16-bit branch displacement. Otherwise it advances the script pointer by two bytes to skip that displacement. Both paths return carry set so the current thread continues in the same turn.

The host-side model is [8CD491_opcode_0a_jump_if_currency_at_least.c](../../../reconstructed-c/8C/8CD491_opcode_0a_jump_if_currency_at_least.c). It delegates currency bus reads, script stream fetches, and the taken relative jump to VM interfaces.

## Evidence

- Vanilla VFS disassembly at `$8C:D491`–`$8C:D4C1`: evaluates the currency offset, reads the 16-bit and 8-bit threshold parts, subtracts them from the three-byte balance with borrow propagation, and tests the signed result.
- The successful comparison jumps to `$8C:D434`; the failed comparison branches to `$8C:D4BC`, which advances DP `$82` twice before `SEC; RTS`.
- Opcode VFS entry `0x0A` identifies operands `E u16 u8 r16` and handler `$8C:D491`.