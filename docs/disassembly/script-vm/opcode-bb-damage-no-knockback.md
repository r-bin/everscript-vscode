# Script Opcode 0xBB: Damage Without Knockback

**Handler:** `$8C:E467`–`$8C:E485`\
**Opcode table entry:** `$8C:EA33`\
**Operands:** entity expression, amount expression\
**Confidence:** operand flow, guards, helper call, and return carry confirmed

## Control Flow

The handler evaluates an entity into DP `$4C` and an amount into `$02`. It skips queuing
when the entity's current HP at `entity + $2A` is zero or bit `$1000` is set in the word
at `entity + $10`. Otherwise, it calls `$8F:C16E` to add the amount to pending damage
without knockback.

The handler sets carry and returns on both the skipped and queued paths. Opcode `0x92`
also enters this handler when its one-shot `$23D5` redirect flag is set.

## Reconstruction

The shared `0x92` / `0xBB` host-side model is in
[`reconstructed-c/8C/8CE430_opcode_92_damage.c`](../../../reconstructed-c/8C/8CE430_opcode_92_damage.c).
The `$8F:C16E` queue helper is modeled as opaque.

## Evidence and Boundaries

- The opcode table entry at `$8C:EA33` selects `$8C:E467`.
- `$8C:E467` and `$8C:E46B` evaluate the two operands; `$8C:E471` checks `+$2A`, and
  `$8C:E476` tests bit `$1000` in `+$10`.
- `$8C:E480` calls `$8F:C16E`; `$8C:E484` sets carry before returning.
- `$8F:C16E` adds to `+$76` and ORs `$0018` into `+$12`.