# Script Opcode 0x8F: Jump if Currency Is Below an Amount

**Handler:** `$8C:D4C2`–`$8C:D500`\
**Opcode table entry:** `$8C:E9DB`\
**Operands:** currency offset expression, amount expression, relative 16-bit target\
**Confidence:** direct comparison and branch flow confirmed

## Control Flow

The handler evaluates the currency offset and amount expressions, zeroes the amount's high
byte, and compares the 24-bit balance at `$00:0AC6 + offset` / `$00:0AC8 + offset` with
that amount.

- If the balance is below the amount, it tail-jumps to `$8C:D434`, which consumes the
  relative 16-bit target and updates the script pointer (including its bank on crossing).
- Otherwise, it advances the script pointer by two bytes to skip the target operand.

Both paths return carry set, so execution continues in the same script turn at the
resulting pointer. This is the inverse branch condition of opcode `0x8E`.

## Reconstruction

The C model is in
[`reconstructed-c/8C/8CD4C2_opcode_8f_jump_if_currency_below.c`](../../../reconstructed-c/8C/8CD4C2_opcode_8f_jump_if_currency_below.c).
The common relative-jump helper is treated as an opaque call.

## Evidence and Boundaries

- The opcode table at `$8C:E9DB` points to `$8C:D4C2`.
- `$8C:D4E6` compares the low word; `$8C:D4ED` masks the high read to a byte and subtracts
  the zero high amount byte while preserving the low-word borrow.
- The not-taken path at `$8C:D4FB` increments `$82` twice, sets carry, and returns at
  `$8C:D500`.
- The taken path jumps to `$8C:D434`, the shared 16-bit relative-jump helper.