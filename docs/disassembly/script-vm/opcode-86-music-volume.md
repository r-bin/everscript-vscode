# Script Opcode 0x86: Set Music Volume

**Handler:** `$8C:E27B`–`$8C:E294`\
**Opcode table entry:** `$8C:E9C9`\
**Operand:** one expression\
**Confidence:** direct control flow confirmed; APU handshake internals are outside this reconstruction

## Control Flow

The handler evaluates an expression and masks the result with `$00FF`. It writes the
zero-extended byte to direct-page word `$9A`, preserves the current data bank while
switching to bank `$80`, and calls `$8C:81FD` with command `$0028` in A and the masked
volume in Y. It restores the saved data bank, sets carry, and returns. Carry set means the
script VM continues with the next opcode in the same turn.

## Reconstruction

The wrapper model is in
[`reconstructed-c/8C/8CE27B_opcode_86_music_volume.c`](../../../reconstructed-c/8C/8CE27B_opcode_86_music_volume.c).
The APU handshake is treated as an opaque call.

## Evidence and Boundaries

- The opcode table at `$8C:E9C9` points to `$8C:E27B`.
- The expression result is masked before the write to `$9A` and transfer to Y.
- The handler calls `$8C:81FD` with A = `$0028`, restores the bank, then executes
  `SEC; RTS` at `$8C:E293`–`$8C:E294`.
- `$8C:E295` is outside the displayed handler body; no following routine boundary is
  inferred here.