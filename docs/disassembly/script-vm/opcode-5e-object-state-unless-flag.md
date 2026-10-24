# Script Opcode 0x5E: Set Object State Unless Flag

**Handler:** `$8C:DE2E`\
**Operands:** object-index expression, `u16` save-flag ID\
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler evaluates the object index and reads a 16-bit save-flag ID. It selects the corresponding bit mask from `$80:A87F` and tests the save byte at `$2258 + (flag_id >> 3)`. If the flag is set, the selected mask itself remains in A as the requested object state. If clear, the handler loads `$7F`. It passes the object index and requested state to `$90:A36D`, then returns carry set.

The `$90:A36D` helper clamps the requested value against the object's state limit. Do not simplify the set-flag path to state `0`: the assembly preserves the bit-mask value. This opcode has no original-script reachability, so it is not included in the CDL-root progress count.

The host-side model is [8CDE2E_opcode_5e_object_state_unless_flag.c](../../../reconstructed-c/8C/8CDE2E_opcode_5e_object_state_unless_flag.c). Save-flag mask lookup and shared map-object state mutation remain named helper boundaries.