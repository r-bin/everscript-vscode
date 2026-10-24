# Script Opcode 0x91: Set Brightness

**Handler:** `$8C:DC56`–`$8C:DC73`\
**Opcode table entry:** `$8C:E9DF`\
**Operand:** one expression\
**Confidence:** branch conditions, memory writes, and return carry confirmed

## Control Flow

The handler reads a 16-bit value from `$7E:0105` and selects among three paths:

- If bit 15 is set, it calls the camera-centering routine at `$90:94AB`, then clears the
  word at `$7E:0106`.
- Otherwise, if bits 8–11 are all clear, it calls the synchronized transition wait at
  `$80:85D8`, then calls `$90:94AB` and clears `$7E:0106`.
- Otherwise, it skips those calls and the `$7E:0106` clear.

All paths evaluate the operand expression, store its 16-bit result directly at
`$7E:0106`, set carry, and return. Unlike opcode `0x90`, this handler does not OR the
expression result with `$8000` or write `$7E:0B83`.

## Reconstruction

The host-side control-flow model is in
[`reconstructed-c/8C/8CDC56_opcode_91_set_brightness.c`](../../../reconstructed-c/8C/8CDC56_opcode_91_set_brightness.c).
The synchronization-wait and camera routines are modeled as opaque calls.

## Evidence and Boundaries

- The opcode table entry at `$8C:E9DF` selects `$8C:DC56`.
- `$8C:DC56` loads `$0105`; `BMI` at `$8C:DC59` tests bit 15, and `BIT #$0F00` at
  `$8C:DC5B` / `BNE` at `$8C:DC5E` tests whether any bits 8–11 are set.
- `$8C:DC60` calls `$80:85D8`; `$8C:DC64` calls `$90:94AB`; `$8C:DC68` clears `$0106`.
- `$8C:DC6B` evaluates one expression, `$8C:DC6F` stores it at `$0106`, and `$8C:DC72`
  sets carry before returning.