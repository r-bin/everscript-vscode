# Script Opcode 0x84: Add to a 24-Bit Amount

**Handler:** `$8C:D588`–`$8C:D5A9`\
**Opcode table entry:** `$8C:E9C5`\
**Operands:** two expressions: offset, then amount\
**Confidence:** direct control flow and arithmetic sequence confirmed

## Control Flow

The handler evaluates the first expression and saves it as X, then evaluates the second
expression. Let `offset` be the first result and `amount` the second. It adds `amount` to
the 16-bit word at `$00:0AC6 + offset`, stores the low result, switches the accumulator to
8-bit mode, and executes `TDC` before adding to the byte at `$00:0AC8 + offset`.

The high-byte addition therefore uses the low byte transferred from the CPU direct-page
register by `TDC`, plus the carry from the low-word addition. The C model reads that
register explicitly; it does not assume its value is zero. `$00:0AC6` and `$00:0AC8` are
the bus addresses used by the handler and map to the corresponding WRAM mirrors.

The handler restores 16-bit accumulator mode, sets carry, and returns. Carry set means the
script VM continues with the next opcode in the same turn.

## Reconstruction

The C model is in
[`reconstructed-c/8C/8CD588_opcode_84_currency_add.c`](../../../reconstructed-c/8C/8CD588_opcode_84_currency_add.c).

## Evidence and Boundaries

- The opcode table at `$8C:E9C5` points to `$8C:D588`.
- The first expression is saved and restored into X before the second expression is
  evaluated.
- The low word is updated at `$00:0AC6,X`; after `SEP #$20`, `TDC` and `ADC` update
  `$00:0AC8,X`.
- `$8C:D5A8` sets carry and `$8C:D5A9` returns; `$8C:D5AA` begins opcode `0x7E`.