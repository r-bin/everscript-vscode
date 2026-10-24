# Script Opcode 0xA5: Call Backward

**Handler entry:** `$8C:D35C`\
**Opcode table entry:** `$8C:EA07`\
**Operand:** one byte\
**Confidence:** operand consumption, backward address arithmetic, slot handoff, and carry-clear return confirmed

## Control Flow

The handler takes the opcode's packed 24-bit address, reads one operand byte, and
subtracts the backward distance `256 - operand`. This selects a script entry from one
to 256 bytes before the opcode; if the target crosses a bank boundary, the packed
address arithmetic changes the bank as well.

The selected target is handed to `$8C:CF18` through the shared child-script call path.
The handler returns carry clear after the child slot and run-list bookkeeping are
updated. The allocator and thread-record mutations are modeled by the existing shared
`script_chain_call` helper.

## Reconstruction

The opcode model is in
[`reconstructed-c/8C/8CD331_callback_dispatch.c`](../../../reconstructed-c/8C/8CD331_callback_dispatch.c).

## Evidence

- `$8C:D35C` loads the current script PC, decrements it to the opcode address, and saves it.
- `$8C:D360` reads and consumes the operand; `$8C:D364` sign-extends the byte with `$FF00`.
- `$8C:D36C`–`$8C:D386` calculate the target from the opcode address and adjust the packed
  bank/PC representation when the subtraction crosses a boundary.
- `$8C:D388` joins `$8C:D3DA`, the shared child-slot allocation and call path.
- `$8C:D3FB` clears carry before returning.