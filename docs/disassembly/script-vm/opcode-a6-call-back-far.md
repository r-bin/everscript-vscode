# Script Opcode 0xA6: Call Backward with a 16-Bit Offset

**Handler entry:** `$8C:D340`\
**Opcode table entry:** `$8C:EA09`\
**Operand:** one little-endian 16-bit offset\
**Confidence:** operand consumption, packed-address arithmetic, shared slot handoff, and carry-clear return confirmed

## Control Flow

The handler identifies the opcode's packed address, reads the following 16-bit word,
and calculates the target as:

`target = packed(opcode) + operand - $10000`

The arithmetic is 24-bit packed bank/PC arithmetic, so the target may cross a bank
boundary. The result is sent to the shared `$8C:CF18` script-slot allocation and child
call path at `$8C:D388`. The handler returns carry clear. Slot allocation and thread
record updates remain modeled by the shared `script_chain_call` helper.

## Reconstruction

The opcode model is in
[`reconstructed-c/8C/8CD331_callback_dispatch.c`](../../../reconstructed-c/8C/8CD331_callback_dispatch.c).

## Evidence

- `$8C:D340` saves the opcode address; `$8C:D344` reads and consumes the two-byte operand.
- `$8C:D34A` branches into the common target calculation at `$8C:D367`.
- `$8C:D36C`–`$8C:D386` compute the packed target, including bank-boundary adjustment.
- `$8C:D388` jumps to the shared `$8C:D3DA` slot-allocation path.
- `$8C:D3FB` clears carry before return.