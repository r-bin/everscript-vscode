# Script Opcode 0x92: Damage an Entity

**Handler:** `$8C:E430`–`$8C:E466`\
**Opcode table entry:** `$8C:E9E1`\
**Operands:** entity expression, amount expression\
**Confidence:** handler control flow and helper selection confirmed

## Control Flow

The handler reads and clears the 16-bit one-shot flag at `$7E:23D5`. If it was nonzero,
execution enters the `$8C:E467` opcode `0xBB` handler without consuming either operand
first. That handler evaluates the entity and amount, applies the shared entity guards,
and calls `$8F:C16E` to queue damage without knockback.

Otherwise, opcode `0x92` evaluates the entity and amount. It skips the remaining work when
the entity's current HP at `entity + $2A` is zero or bit `$1000` is set in the word at
`entity + $10`. For an eligible entity, a nonzero `$7E:23D7` is cleared and the amount is
passed through `$8F:C06D`; the resulting amount is then passed to `$8F:C121`.

Both the normal and redirected paths set carry and return, continuing the current script
turn. `$23D7` is not consumed when the entity fails either guard.

## Reconstruction

The host-side models for opcodes `0x92` and `0xBB` are in
[`reconstructed-c/8C/8CE430_opcode_92_damage.c`](../../../reconstructed-c/8C/8CE430_opcode_92_damage.c).
The damage transform and pending-damage helpers are kept opaque; their known call
addresses and effects are described below.

## Evidence and Boundaries

- The opcode table entry at `$8C:E9E1` selects `$8C:E430`.
- `$8C:E430` reads then clears `$23D5`; a nonzero original value branches to `$8C:E467`.
- `$8C:E438` evaluates the entity into DP `$4C`; `$8C:E43C` evaluates the amount into
  `$02`; `$8C:E442` checks `+$2A`, and `$8C:E447` tests bit `$1000` in `+$10`.
- `$8C:E44F` checks `$23D7`; only the eligible path clears it and calls `$8F:C06D`.
- `$8C:E461` calls `$8F:C121`. Both `$8C:E465` and `$8C:E484` set carry before returning.
- `$8F:C121` adds to entity field `+$76` and ORs `$0038` into `+$12`.
- The redirect target `$8C:E467` is opcode `0xBB`; its handler calls `$8F:C16E`, which
  adds to `+$76` and ORs `$0018` into `+$12`.