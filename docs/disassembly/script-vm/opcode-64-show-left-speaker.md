# Script Opcode 0x64: Show Left Speaker Figure

**Handler:** `$8C:DE9B`\
**Operands:** entity expression\
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler evaluates an entity expression, stores the result in `$7E:0B73`, loads X with `1` to select the left speaker slot, and calls `$8C:C627`. That helper handles the slot's opening/closing state and figure drawing. The opcode returns carry set.

The host-side model is [8CDE9B_opcode_64_show_left_speaker.c](../../../reconstructed-c/8C/8CDE9B_opcode_64_show_left_speaker.c). Portrait animation remains delegated to the dialogue helper. This opcode is unused by original scripts and is not included in the CDL-root progress count.