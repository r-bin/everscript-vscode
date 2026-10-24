# Script Opcode 0xB4: Start a Thread with Arguments

**Handler entry:** `$8C:D3FD`\
**Argument evaluator:** `$8C:D315`\
**Slot allocator:** `$8C:CF18`\
**Run-list insertion:** `$8C:CE86`\
**Opcode table entry:** `$8C:EA25`\
**Operands:** argument count and expressions, then a 16-bit target PC and bank byte\
**Confidence:** argument and target decoding, child setup, and run-list insertion confirmed

## Control Flow

The handler evaluates arguments into the call-argument area, reads a little-endian target
PC and bank byte, allocates a script slot, copies the parent bank field into the child,
and enqueues the child through `$8C:CE86`. Unlike opcode AF, it does not suspend the
caller; the child is added to the run list for a later scheduler pass.

When the caller's `+$0D` bank field is nonzero, the handler increments child `+$3E`.
That conditional relationship is represented by the opaque `script_vm_link_async_thread`
hook; its domain meaning is not asserted. Slot allocation failure behavior is likewise
left at the shared allocator abstraction boundary.

## Model

[`reconstructed-c/8C/8CD331_callback_dispatch.c`](../../../reconstructed-c/8C/8CD331_callback_dispatch.c)
contains the B4 handler alongside the related call and trigger dispatch paths.

## Evidence

- `$8C:D3FD` calls `$8C:D315`; `$8C:D400` through `$8C:D40C` read the count/target
  operands and save target values in DP `$26` and `$28`.
- `$8C:D40E` calls `$8C:CF18`; `$8C:D412` copies the parent's `+$0D` field to the child.
- `$8C:D41A` conditionally updates child `+$3E` when the copied bank is nonzero.
- `$8C:D422` calls `$8C:CE86` to append the child to the run list; `$8C:D426` returns
  carry set, so the caller continues.