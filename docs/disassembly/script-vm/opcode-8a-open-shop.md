# Script Opcode 0x8A: Open Shop

**Handler:** `$8C:E357`–`$8C:E37A`\
**Opcode table entry:** `$8C:E9D1`\
**Operand:** one expression\
**Confidence:** direct control flow confirmed; indexed table semantics and extent unresolved

## Control Flow

The handler evaluates one expression and stores the result at `$7E:05A7`. It writes
`$8E99` to direct-page word `$98`, loads `$7E:0E6C` into X, then reads a word from long
address `$8C:E37B + X`.

- If the loaded word is zero, it skips the shop call.
- Otherwise, it stores the word at direct-page `$97`, preserves the current data bank while
  switching to `$80`, calls `$8E:9FA8`, then restores the saved bank.

Both paths set carry and return. The indexed words at `$8C:E37B` are data consumed by the
handler; their total extent and meanings are not inferred here.

## Reconstruction

The control-flow model is in
[`reconstructed-c/8C/8CE357_opcode_8a_open_shop.c`](../../../reconstructed-c/8C/8CE357_opcode_8a_open_shop.c).
The menu call and indexed table are opaque beyond the values directly passed or tested.

## Evidence and Boundaries

- The opcode table at `$8C:E9D1` points to `$8C:E357`.
- The handler ends at `$8C:E37A`; `$8C:E379` sets carry and `$8C:E37A` returns.
- `$8C:E37B` is the base of the indexed read and lies outside the handler.