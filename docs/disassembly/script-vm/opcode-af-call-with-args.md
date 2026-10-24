# Script Opcode 0xAF: Call a Script with Arguments

**Handler entry:** `$8C:D3C6`\
**Argument evaluator:** `$8C:D315`\
**Slot allocator:** `$8C:CF18`\
**Opcode table entry:** `$8C:EA1B`\
**Operands:** argument count and expressions, then a 16-bit target PC and bank byte\
**Confidence:** argument/target decoding and child-thread handoff confirmed; allocation failure details are represented by the shared model

## Control Flow

The handler calls `$8C:D315` to evaluate the counted argument list into the call-argument
area at `$0E80`. It then reads the target PC as a little-endian word, reads the target
bank byte, allocates a script slot, and chains execution to that far target. The caller's
resume location is after the three target bytes.

The C reconstruction uses the callback dispatcher's existing argument and thread-chain
helpers. Its allocation-failure behavior follows that shared abstraction; it is not a
register-for-register model of every branch in the allocator path.

The model is in
[`reconstructed-c/8C/8CD331_callback_dispatch.c`](../../../reconstructed-c/8C/8CD331_callback_dispatch.c).

## Evidence

- `$8C:D3C6` calls `$8C:D315`.
- `$8C:D3C9` reads the target word and advances DP `$82` twice; `$8C:D3D1` reads the
  bank byte and advances it once.
- `$8C:D3DA` calls `$8C:CF18` to allocate a script slot.
- `$8C:D3DE` through `$8C:D3E7` copies the caller's resume PC and bank into the child
  thread record before control is chained.