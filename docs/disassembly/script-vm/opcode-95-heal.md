# Script Opcode 0x95: Heal an Entity

**Handler:** `$8C:E420`–`$8C:E42F`\
**Opcode table entry:** `$8C:E9E7`\
**Operands:** entity expression, amount expression\
**Confidence:** operand flow, helper call, and return carry confirmed

## Control Flow

The handler evaluates the entity expression into DP `$4C`, evaluates the amount
expression into A, loads Y from `$4C`, and calls `$8F:C0A5`. It then sets carry and returns,
continuing the current script turn.

The helper adds HP up to the target's maximum and performs the documented HUD/state
updates. Its healing pipeline is covered in
[`healing-spells.md`](../combat/healing-spells.md).

## Reconstruction

The host-side opcode model is in
[`reconstructed-c/8C/8CE420_opcode_95_heal.c`](../../../reconstructed-c/8C/8CE420_opcode_95_heal.c).
The `$8F:C0A5` helper remains an opaque call in this opcode-level model.

## Evidence and Boundaries

- The opcode table entry at `$8C:E9E7` selects `$8C:E420`.
- `$8C:E420` calls entity-expression evaluator `$8C:EC8E`; `$8C:E424` calls expression
  evaluator `$8C:EA43`.
- `$8C:E428` loads Y from `$4C`; `$8C:E42A` calls `$8F:C0A5`.
- `$8C:E42E` sets carry before returning.