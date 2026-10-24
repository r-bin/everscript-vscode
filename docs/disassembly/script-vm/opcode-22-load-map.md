# Script Opcode 0x22: Load a Map at a Tile

**Routine:** `$8C:DB71`\
**Range:** `$8C:DB71`–`$8C:DBB8`\
**Confidence:** confirmed

## Behavior

The handler waits for a synchronized transition frame, stops all script threads and room entities, reads X/Y tile coordinates and a 16-bit map/entrance value, and writes that value to `$7E:0ADB`. It resets per-room state with `$90:8E90`, places Boy and Dog at the scaled tile coordinates on layer zero while centering the camera, then starts the new room's enter script. Finally, it clears DP `$83`, sets DP `$80` to `$FFFE`, and returns with carry clear.

The host-side model is [8CDB71_opcode_22_load_map.c](../../../reconstructed-c/8C/8CDB71_opcode_22_load_map.c). It delegates engine calls to named helpers and uses the script VM's DB-word write abstraction for `$0ADB`.

## Evidence

- Vanilla VFS at `$8C:DB71` calls `$80:85D8`, `$8C:CEE9`, and `$8F:B38E` before reading operands.
- The first two bytes are masked to one byte and shifted left three times into DP `$46`/`$48`; the next two bytes are stored as a word at `$0ADB`.
- It calls `$90:8E90`, restores Y/X pixel coordinates from the stack, clears DP `$44`, and calls `$8F:B434` followed by `$8C:CE99`.
- The handler then executes `STZ $83`, stores `$FFFE` to `$80`, and ends with `CLC; RTS`.
- Opcode table entry `$8C:E901` maps `0x22` to `$8C:DB71`; opcode metadata lists operands `u8 u8 u16` and identifies it as a map load.