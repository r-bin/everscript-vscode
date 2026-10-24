# Script Opcode 0x5D: Set Object State from Save Flag

**Handler:** `$8C:DDFF`\
**Operands:** object-index expression, `u16` save-flag ID\
**Confidence:** confirmed

The handler evaluates the object index, reads the 16-bit save-flag ID, and tests that flag. A set flag selects requested state `$7F` (the object state's maximum sentinel, clamped by `$90:A36D`); a clear flag selects state `0`. The handler passes the object index and derived state to `$90:A36D`, then returns carry set.

The host-side model is [8CDDFF_opcode_5d_object_state_by_flag.c](../../../reconstructed-c/8C/8CDDFF_opcode_5d_object_state_by_flag.c). Save-flag lookup and shared map-object state mutation remain named helper boundaries.

## Evidence

- Opcode table entry `$8C:E977` dispatches to `$8C:DDFF`.
- The handler evaluates the object-index expression, consumes a 16-bit flag ID, and divides that ID by eight to address the save byte at `$2258 + (flag_id >> 3)`; the low three bits select a mask from `$80:A87F`.
- A clear bit selects `0`; a set bit selects `$7F`. Both paths call `$90:A36D` with the object index in X, then execute `SEC; RTS`.