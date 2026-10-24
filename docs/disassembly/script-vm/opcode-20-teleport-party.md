# Script Opcode 0x20: Teleport the Party to a Tile

**Routine:** `$8C:DBF0`\
**Range:** `$8C:DBF0`–`$8C:DC0F`\
**Confidence:** confirmed operand flow and engine call

## Behavior

The handler reads an 8-bit X tile coordinate and an 8-bit Y tile coordinate, multiplies each by eight, selects layer zero, and calls `$8F:B434` to place Boy and Dog and center the camera. It returns carry set for same-turn continuation.

The host-side model is [8CDBF0_opcode_20_teleport_party.c](../../../reconstructed-c/8C/8CDBF0_opcode_20_teleport_party.c). It delegates the shared party placement/camera routine to an engine helper.

## Evidence

- Vanilla VFS at `$8C:DBF0` fetches each operand through `[$82]`, masks it to one byte, shifts left three times, and stores X/Y pixel coordinates at direct-page `$46`/`$48`.
- It clears direct-page `$44`, calls `$8F:B434`, then returns with `SEC; RTS`.
- The `$8F:B434` VFS annotation identifies its work as centering the camera and teleporting Boy and Dog to the spawn coordinates. Opcode VFS entry `0x20` lists operands `u8 u8`.