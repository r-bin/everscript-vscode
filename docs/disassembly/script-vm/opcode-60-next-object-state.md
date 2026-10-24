# Script Opcode 0x60: Next Map Object State

**Handler:** `$8C:DDDB`\
**Operands:** object-index expression\
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler evaluates the object index, reads the target state from `$7E:107E,X`, keeps its low byte, increments it by one, and passes the result to `$90:A36D`. The shared helper clamps the requested target and schedules its transition. The opcode returns carry set.

The host-side model is [8CDDDB_opcode_60_next_object_state.c](../../../reconstructed-c/8C/8CDDDB_opcode_60_next_object_state.c). This opcode is unused by original scripts and is not included in the CDL-root progress count.