# Script Opcode 0xAB: Reset Game

**Handler entry:** `$8C:E8B1`\
**Reset setup:** `$80:84C9`\
**Reset entry:** `$80:8034`\
**Opcode table entry:** `$8C:EA13`\
**Operands:** none\
**Confidence:** instruction sequence and final jump confirmed

## Control Flow

The opcode handler uses `JML` to transfer directly to `$80:84C9`. That routine:

1. Writes `$50` to `$2100`.
2. Writes zero to `$4200`, current data-bank offsets `$0E65` and `$0E6B`, and `$420C`.
3. Sets the stack pointer to `$1FFF`, pushes `$0001`, and disables interrupts.
4. Jumps long to `$80:8034`.

The two direct-page-bank-dependent stores are kept as raw current-DB offsets in the
model; their bank is not inferred here. This is a terminal game-control transfer, not a
host-process reset.

## Model

[`reconstructed-c/8C/8CE8B1_opcode_ab_reset_game.c`](../../../reconstructed-c/8C/8CE8B1_opcode_ab_reset_game.c)
expresses the ordered hardware and CPU effects through explicit host-side hooks.

## Evidence

- `$8C:E8B1` is `JML $8084C9`.
- `$80:84C9` writes `$50` to `$2100`; zero to `$4200`, `$0E65`, `$0E6B`, and `$420C`;
  resets SP to `$1FFF`; pushes `$0001`; executes `SEI`; then jumps to `$808034`.