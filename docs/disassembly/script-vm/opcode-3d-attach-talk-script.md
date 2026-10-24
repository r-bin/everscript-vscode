# Script Opcode 0x3D: Attach a Talk Script

**Routine:** `$8C:DD4B`\
**Range:** `$8C:DD4B`–`$8C:DD5F`\
**Confidence:** confirmed

## Behavior

The handler evaluates an entity expression, reads a 16-bit trigger ID from the script stream, stores it at entity offset `+$66`, and writes `$0040` to the entity event mask at `+$68`. It returns carry set.

The host-side model is [8CDD4B_opcode_3d_attach_talk_script.c](../../../reconstructed-c/8C/8CDD4B_opcode_3d_attach_talk_script.c).

## Evidence

- `$8C:DD4B` calls `$8C:EC8E` to evaluate the entity expression.
- It reads the following word through `[$82]` and increments `$82` twice.
- The word is stored at `+$66`; `$0040` is stored at `+$68`.
- The handler ends with `SEC; RTS`.