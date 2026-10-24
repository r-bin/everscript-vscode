# Script Opcode 0x9D: Walk an Entity to a Point

**Handler entry:** `$8C:DA88`\
**Shared movement path:** `$8C:DA90`–`$8C:DABE`\
**Opcode table entry:** `$8C:E9F7`\
**Operands:** entity expression, X expression, Y expression\
**Confidence:** operand order, mode selection, guard, helper call, and return carry confirmed

## Control Flow

The opcode entry pushes mode zero and branches into the shared movement path. That path
evaluates the entity, then the X and Y expressions, staging the coordinates at DP `$46`
and `$48`. It loads the entity index from DP `$4C` and checks the current HP at
`entity + $2A` only when the index is below `$4E89`. A zero-HP entity below that threshold
skips pathfinding; other entities continue to `$8F:AA82`.

Both paths set carry and return, continuing the current script turn. The separate
`$8F:AAD3` call lies on the shared routine's nonzero-mode path; opcode `0x9D` selects mode
zero and does not take that path.

## Reconstruction

The host-side mode-zero model is in
[`reconstructed-c/8C/8CDA88_opcode_9d_walk_to.c`](../../../reconstructed-c/8C/8CDA88_opcode_9d_walk_to.c).
The pathfinding helper remains opaque.

## Evidence and Boundaries

- `$8C:DA88` pushes zero and branches to `$8C:DA90`.
- `$8C:DA90` evaluates the entity; `$8C:DA94` and `$8C:DA9A` evaluate X and Y into DP
  `$46` and `$48`; `$8C:DAA0` moves the mode value to DP `$12`.
- `$8C:DAA6` loads the entity index; `$8C:DAA8` compares with `$4E89`. Below that
  threshold, `$8C:DAAD` reads `+$2A`, and `$8C:DAB0` skips the helper when it is zero.
- With mode zero, `$8C:DAB9` calls `$8F:AA82`; `$8C:DABD` sets carry before returning.