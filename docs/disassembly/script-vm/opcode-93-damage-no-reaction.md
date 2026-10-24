# Script Opcode 0x93: Damage Without a Reaction

**Handler:** `$8C:E486`–`$8C:E49C`\
**Opcode table entry:** `$8C:E9E3`\
**Operands:** entity expression, amount expression\
**Confidence:** operand flow, HP guard, helper call, and return carry confirmed

## Control Flow

The handler evaluates an entity into DP `$4C` and an amount into `$02`. It reads the
entity's HP at `entity + $2A`; when HP is nonzero, it calls `$8F:C132` with the amount.
When HP is zero, it skips the helper call. There is no `$10` flag test in this handler.

Both paths set carry and return, continuing the current script turn. `$8F:C132` adds the
amount to pending damage at `+$76` and ORs `$0008` into `+$12`.

## Reconstruction

The host-side model is in
[`reconstructed-c/8C/8CE486_opcode_93_damage_no_reaction.c`](../../../reconstructed-c/8C/8CE486_opcode_93_damage_no_reaction.c).
The pending-damage helper is modeled as opaque.

## Evidence and Boundaries

- The opcode table entry at `$8C:E9E3` selects `$8C:E486`.
- `$8C:E486` and `$8C:E48A` evaluate the entity and amount; `$8C:E490` reads `+$2A`.
- `$8C:E493` skips `$8F:C132` when HP is zero; `$8C:E497` calls it otherwise.
- `$8C:E49B` sets carry before returning.
- `$8F:C132` adds to `+$76` and ORs `$0008` into `+$12`.