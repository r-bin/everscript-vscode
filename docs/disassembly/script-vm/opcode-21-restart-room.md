# Script Opcode 0x21: Restart the Current Room

**Routine:** `$8C:DBB9`\
**Range:** `$8C:DBB9`–`$8C:DBEF`\
**Confidence:** confirmed

## Behavior

The handler performs a synchronized room transition, stops all script threads and room entities, reads X and Y tile bytes, scales each by eight, and places Boy and Dog at layer zero while centering the camera. It then starts the room's enter script, clears DP `$83`, sets DP `$80` to `$FFFE`, and returns with carry clear, ending the current script turn.

This is a same-room restart, corresponding to opcode `0x22` without its map-ID/entrance operand or per-room state reset. The opcode is unused by vanilla scripts according to the static script walk; that does not establish whether modified scripts can safely invoke it.

The host-side model is [8CDBB9_opcode_21_restart_room.c](../../../reconstructed-c/8C/8CDBB9_opcode_21_restart_room.c). It delegates the engine routines at `$80:85D8`, `$8C:CEE9`, `$8F:B38E`, `$8F:B434`, and `$8C:CE99` to named helpers.

## Evidence

- Vanilla VFS at `$8C:DBB9` calls `$80:85D8`, `$8C:CEE9`, and `$8F:B38E` before reading either coordinate.
- Each coordinate is fetched through `[$82]`, masked to one byte, shifted left three times, and written to DP `$46` or `$48`; DP `$44` is cleared before `$8F:B434` is called.
- The handler calls `$8C:CE99`, executes `STZ $83`, loads `$FFFE` into A and stores it to `$80`, then ends with `CLC; RTS`.
- Opcode table entry `$8C:E8FF` maps `0x21` to `$8C:DBB9`; the opcode metadata lists operands `u8 u8` and identifies the restart behavior.