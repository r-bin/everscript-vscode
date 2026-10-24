# Script Opcode 0x94: Heal an Entity with an Effect

**Handler:** `$8C:E410`–`$8C:E41F`\
**Opcode table entry:** `$8C:E9E5`\
**Operands:** entity expression, amount expression\
**Confidence:** operand flow, helper call, and return carry confirmed

## Control Flow

The handler evaluates the entity expression into DP `$4C`, evaluates the amount
expression into A, loads Y from `$4C`, and calls `$8F:C09A`. It then sets carry and returns,
continuing the current script turn.

The helper applies HP restoration and its associated palette/HUD/state effects; its
separate mechanics documentation is
[`healing-spells.md`](../combat/healing-spells.md).

## Reconstruction

The host-side opcode model is in
[`reconstructed-c/8C/8CE410_opcode_94_heal_with_effect.c`](../../../reconstructed-c/8C/8CE410_opcode_94_heal_with_effect.c).
The `$8F:C09A` helper remains an opaque call in this opcode-level model.

## Evidence and Boundaries

- The opcode table entry at `$8C:E9E5` selects `$8C:E410`.
- `$8C:E410` calls entity-expression evaluator `$8C:EC8E`; `$8C:E414` calls expression
  evaluator `$8C:EA43`.
- `$8C:E418` loads Y from `$4C`; `$8C:E41A` calls `$8F:C09A`.
- `$8C:E41E` sets carry before returning.