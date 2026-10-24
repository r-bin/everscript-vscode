# Script Opcode 0x5C: Set Map Object State

**Handler:** `$8C:DDCB`\
**Operands:** two expression streams (object index, requested state)\
**Confidence:** confirmed

The handler evaluates the object index first and preserves it while evaluating the requested state. It passes the index in X and state in A to `$90:A36D`, then returns carry set. The state routine performs object-record lookup, clamps the requested state to the object's supported range, updates the target-state table, and arms animation when the target differs from the current state.

The host-side opcode model is [8CDDCB_opcode_5c_set_object_state.c](../../../reconstructed-c/8C/8CDDCB_opcode_5c_set_object_state.c). The map-object transition engine remains behind the `map_object_set_state` helper boundary.

## Evidence

- Opcode table entry `$8C:E975` dispatches to `$8C:DDCB`.
- `$8C:DDCB` calls `$8C:EA43`, saves the result, calls `$8C:EA43` again, restores the first result into X, then calls `$90:A36D` and executes `SEC; RTS`.
- `$90:A36D` uses the object index to locate its record and updates the target state in `$7E:107E,X`.