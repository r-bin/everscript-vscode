# Script Opcode 0x68: Show Right Speaker Figure

**Handler:** `$8C:DEBD`\
**Operands:** entity expression\
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler evaluates an entity expression, stores the result in `$7E:0B75`, loads X with `2` to select the right speaker slot, calls `$8C:C627`, and returns carry set. The helper owns portrait state transitions and drawing.

The host-side model is [8CDEBD_opcode_68_show_right_speaker.c](../../../reconstructed-c/8C/8CDEBD_opcode_68_show_right_speaker.c). This opcode is unused by original scripts and is not included in the CDL-root progress count.