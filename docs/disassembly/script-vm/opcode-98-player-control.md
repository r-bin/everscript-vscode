# Script Opcode 0x98: Switch the Controlled Character

**Handler:** `$8C:E5A1`–`$8C:E5AF`\
**Opcode table entry:** `$8C:E9ED`\
**Operand:** one expression\
**Confidence:** comparison, conditional call, and return carry confirmed

## Control Flow

The handler evaluates the operand expression and compares the resulting word with
`$7E:0F42`. If the values differ, it calls `$8C:F1A7`; if they are equal, it skips the
call. Both paths set carry and return, continuing the current script turn.

The character-switch helper remains a separate abstraction; its behavior is documented
in the handler's ROM knowledge record.

## Reconstruction

The host-side model is in
[`reconstructed-c/8C/8CE5A1_opcode_98_player_control.c`](../../../reconstructed-c/8C/8CE5A1_opcode_98_player_control.c).

## Evidence and Boundaries

- The opcode table entry at `$8C:E9ED` selects `$8C:E5A1`.
- `$8C:E5A1` evaluates one expression; `$8C:E5A5` compares it with `$0F42`.
- `$8C:E5A8` branches to the return when equal; `$8C:E5AA` calls `$8C:F1A7` otherwise.
- `$8C:E5AE` sets carry before returning.