# Script Opcode 0x9B: Destroy an Entity

**Handler:** `$8C:DD33`–`$8C:DD40`\
**Opcode table entry:** `$8C:E9F3`\
**Operand:** entity expression\
**Confidence:** operand flow, reference decrement, helper call, and return carry confirmed

## Control Flow

The handler evaluates the entity expression, transfers the entity index to X, decrements
the 16-bit reference count at `entity + $3E`, and calls `$8F:B2DE`. It then sets carry and
returns, continuing the current script turn.

The cleanup helper remains opaque here. Its documented behavior includes releasing
attached resources and handling the entity's remaining lifetime according to its
reference count.

## Reconstruction

The host-side handler model is in
[`reconstructed-c/8C/8CDD33_opcode_9b_destroy.c`](../../../reconstructed-c/8C/8CDD33_opcode_9b_destroy.c).

## Evidence and Boundaries

- The opcode table entry at `$8C:E9F3` selects `$8C:DD33`.
- `$8C:DD33` evaluates the entity; `$8C:DD37` transfers the entity index to X.
- `$8C:DD38` decrements the word at `+$3E`; `$8C:DD3B` calls `$8F:B2DE`.
- `$8C:DD3F` sets carry before returning.