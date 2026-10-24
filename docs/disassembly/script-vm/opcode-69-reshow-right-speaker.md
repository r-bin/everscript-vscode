# Script Opcode 0x69: Reshow Right Speaker Figure

**Handler:** `$8C:DED6`\
**Operands:** none\
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler loads X with `2` for the right speaker slot, calls `$8C:C627` using the entity already stored at `$7E:0B75`, and returns carry set. It does not change the stored entity; portrait state transitions and drawing are owned by the helper.

The host-side model is [8CDED6_opcode_69_reshow_right_speaker.c](../../../reconstructed-c/8C/8CDED6_opcode_69_reshow_right_speaker.c). This opcode is unused by original scripts and is not included in the CDL-root progress count.