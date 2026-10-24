# Script Opcode 0x5F: Add to Map Object Target State

**Handler:** `$8C:DE77`\
**Operands:** object-index expression, inline `u16` increment
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler evaluates the object index, reads the current low-byte target from `$7E:107E,X`, reads the next two script bytes directly as an inline `u16` increment, adds it to that target, and passes the sum with the object index to `$90:A36D`. The helper clamps the requested target and schedules its transition. The handler then returns carry set.

The addition is 16-bit accumulator arithmetic; the handler does not explicitly mask the increment or sum to eight bits. The inline read advances the script pointer by two bytes. The shared `$90:A36D` helper remains responsible for clamping.

The host-side model is [8CDE77_opcode_5f_add_object_state.c](../../../reconstructed-c/8C/8CDE77_opcode_5f_add_object_state.c). The opcode is unused in original scripts and is not included in the CDL-root progress count.