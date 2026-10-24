# Script Opcode 0x9C: Release an Entity Reference

**Handler:** `$8C:DD41`–`$8C:DD4A`\
**Opcode table entry:** `$8C:E9F5`\
**Operand:** entity expression\
**Confidence:** operand flow, reference decrement, and return carry confirmed

## Control Flow

The handler evaluates the entity expression, transfers the entity index to X, decrements
the 16-bit reference count at `entity + $3E`, sets carry, and returns. It does not call
the entity cleanup helper used by opcode `0x9B`.

## Reconstruction

The host-side model is in
[`reconstructed-c/8C/8CDD41_opcode_9c_release_entity.c`](../../../reconstructed-c/8C/8CDD41_opcode_9c_release_entity.c).

## Evidence and Boundaries

- The opcode table entry at `$8C:E9F5` selects `$8C:DD41`.
- `$8C:DD41` evaluates the entity; `$8C:DD45` transfers its index to X.
- `$8C:DD46` decrements the word at `+$3E`; `$8C:DD49` sets carry before returning.