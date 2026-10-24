# Script Opcode 0x6A: Hide Right Speaker Figure

**Handler:** `$8C:DECD`\
**Operands:** none\
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler loads X with `2` for the right speaker slot, calls `$8C:C67C`, and returns carry set. The helper waits for the slot's shown state and initiates its closing transition.

The host-side model is [8CDECD_opcode_6a_hide_right_speaker.c](../../../reconstructed-c/8C/8CDECD_opcode_6a_hide_right_speaker.c). This opcode is unused by original scripts and is not included in the CDL-root progress count.