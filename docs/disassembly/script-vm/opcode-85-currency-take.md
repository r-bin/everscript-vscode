# Script Opcode 0x85: Subtract from a 24-Bit Amount

**Handler:** `$8C:D532`–`$8C:D556`\
**Opcode table entry:** `$8C:E9C7`\
**Operands:** two expressions: offset, then amount\
**Confidence:** direct control flow and arithmetic sequence confirmed

## Control Flow

The handler evaluates the first expression and saves it as X, then evaluates the second
expression. It loads the 16-bit word at `$00:0AC6 + offset`, sets carry, subtracts the
amount, and stores the low result. In 8-bit accumulator mode it loads the byte at
`$00:0AC8 + offset`, executes `SBC #$00` using the carry from the low-word subtraction,
and stores the high result. Thus the high byte is always written; it is decremented only
when the low-word subtraction borrowed.

The handler restores 16-bit accumulator mode, sets carry, and returns. Carry set means the
script VM continues with the next opcode in the same turn.

## Reconstruction

The C model is in
[`reconstructed-c/8C/8CD532_opcode_85_currency_take.c`](../../../reconstructed-c/8C/8CD532_opcode_85_currency_take.c).

## Evidence and Boundaries

- The opcode table at `$8C:E9C7` points to `$8C:D532`.
- The first expression is saved and restored into X before the second expression is
  evaluated.
- `SEC; SBC $02` updates `$00:0AC6,X`; the carry then feeds `SBC #$00` at `$00:0AC8,X`.
- `$8C:D555` sets carry and `$8C:D556` returns. The neighboring opcode `0x7E` starts at
  `$8C:D5AA`; it is not part of this handler.