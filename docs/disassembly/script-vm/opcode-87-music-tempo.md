# Script Opcode 0x87: Set Music Tempo

**Handler:** `$8C:E295`–`$8C:E2A9`\
**Opcode table entry:** `$8C:E9CB`\
**Operand:** one expression\
**Confidence:** direct control flow confirmed; APU command semantics supported by opcode knowledge

## Control Flow

The handler evaluates one expression and transfers the full 16-bit result to Y. It
preserves the current data bank while switching to bank `$80`, then calls `$8C:81FD` with
command `$002A` in A and the expression result in Y. It restores the saved data bank, sets
carry, and returns, so the script VM continues with the next opcode in the same turn.

Unlike opcode `0x86`, this handler does not mask the expression to a byte or write direct
page `$9A`.

## Reconstruction

The wrapper model is in
[`reconstructed-c/8C/8CE295_opcode_87_music_tempo.c`](../../../reconstructed-c/8C/8CE295_opcode_87_music_tempo.c).
The APU handshake is treated as an opaque call.

## Evidence and Boundaries

- The opcode table at `$8C:E9CB` points to `$8C:E295`.
- The handler evaluates the expression before the bank-preserving prologue, then transfers
  the result to Y and loads `$002A` into A.
- `$8C:E2A3` calls `$8C:81FD`; `$8C:E2A7` restores the saved bank, `$8C:E2A8` sets carry,
  and `$8C:E2A9` returns.