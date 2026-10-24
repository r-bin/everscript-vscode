# Script Opcode 0x66: Hide Left Speaker Figure

**Handler:** `$8C:DEAB`\
**Operands:** none\
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler loads X with `1` for the left speaker slot, calls `$8C:C67C`, and returns carry set. The helper waits for the slot's shown state and starts its closing transition.

The host-side model is [8CDEAB_opcode_66_hide_left_speaker.c](../../../reconstructed-c/8C/8CDEAB_opcode_66_hide_left_speaker.c). This opcode is unused by original scripts and is not included in the CDL-root progress count.