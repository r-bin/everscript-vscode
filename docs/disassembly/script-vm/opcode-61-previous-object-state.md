# Script Opcode 0x61: Previous Map Object State

**Handler:** `$8C:DDED`\
**Operands:** object-index expression\
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler evaluates the object index, reads `$7E:107E,X`, masks the target to its low byte, decrements A, and passes the result to `$90:A36D`. The decrement is 16-bit: when the low-byte target is zero, the requested value passed to the helper is `$FFFF`. The shared helper clamps the requested target and schedules its transition. The opcode returns carry set.

The host-side model is [8CDDED_opcode_61_previous_object_state.c](../../../reconstructed-c/8C/8CDDED_opcode_61_previous_object_state.c). This opcode is unused by original scripts and is not included in the CDL-root progress count.