# Script Opcode 0x90: Fade to a Brightness

**Handler:** `$8C:DC35`–`$8C:DC55`\
**Opcode table entry:** `$8C:E9DD`\
**Operand:** one expression\
**Confidence:** branch conditions, memory writes, and return carry confirmed

## Control Flow

The handler reads a 16-bit value from `$7E:0105` and selects among three paths:

- If bit 15 is set, it calls the camera-centering routine at `$90:94AB`, then clears the
  word at `$7E:0106`.
- Otherwise, if bits 8–11 are all clear, it calls the synchronized transition wait at
  `$80:85D8`, then calls `$90:94AB` and clears `$7E:0106`.
- Otherwise, it skips those calls and the `$7E:0106` clear.

All paths evaluate the operand expression, OR its result with `$8000`, store that word at
`$7E:0B83`, set carry, and return. The meanings of the tested input bits are not assigned
here.

## Reconstruction

The host-side control-flow model is in
[`reconstructed-c/8C/8CDC35_opcode_90_fade_to.c`](../../../reconstructed-c/8C/8CDC35_opcode_90_fade_to.c).
The synchronization-wait and camera routines are modeled as opaque calls.

## Evidence and Boundaries

- The opcode table entry at `$8C:E9DD` selects `$8C:DC35`.
- `$8C:DC35` loads `$0105`; `BMI` at `$8C:DC38` tests bit 15, and `BIT #$0F00` at
  `$8C:DC3A` / `BNE` at `$8C:DC3D` tests whether any bits 8–11 are set.
- `$8C:DC3F` calls `$80:85D8`; `$8C:DC43` calls `$90:94AB`; `$8C:DC47` clears `$0106`.
- `$8C:DC4A` evaluates one expression, `$8C:DC4E` ORs `$8000`, `$8C:DC51` stores at
  `$0B83`, and `$8C:DC54` sets carry before returning.
- The routine is marked unused by original scripts in the opcode metadata.