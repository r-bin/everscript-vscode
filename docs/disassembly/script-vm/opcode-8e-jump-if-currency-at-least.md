# Script Opcode 0x8E: Jump if Currency Is at Least an Amount

**Handler:** `$8C:D483`–`$8C:D4C1`\
**Opcode table entry:** `$8C:E9D9`\
**Operands:** currency offset expression, amount expression, relative 16-bit target\
**Confidence:** direct comparison and branch flow confirmed

## Control Flow

The handler evaluates the currency offset, then evaluates the amount and sets its high
byte to zero. It reads the 16-bit balance word at `$00:0AC6 + offset` and the high byte
at `$00:0AC8 + offset`, comparing the zero-extended amount against that 24-bit balance.

- If the balance is at least the amount, it tail-jumps to `$8C:D434`, which consumes the
  relative 16-bit target and updates the script pointer (including its bank on crossing).
- Otherwise, it advances the script pointer by two bytes to skip the target operand.

Both paths return carry set, so execution continues in the same script turn at the
resulting pointer.

## Reconstruction

The handler model is in
[`reconstructed-c/8C/8CD483_opcode_8e_jump_if_currency_at_least.c`](../../../reconstructed-c/8C/8CD483_opcode_8e_jump_if_currency_at_least.c).
The shared relative-jump helper is treated as an opaque call.

## Evidence and Boundaries

- The opcode table at `$8C:E9D9` points to `$8C:D483`.
- `$8C:D4A7` compares the low word with `SEC; SBC`; `$8C:D4AE` masks the high read to a
  byte and subtracts the zero high amount byte while preserving the low-word borrow.
- The non-taken path at `$8C:D4BC` increments `$82` twice, sets carry, and returns at
  `$8C:D4C1`.
- The taken path jumps to `$8C:D434`, the shared 16-bit relative-jump helper.