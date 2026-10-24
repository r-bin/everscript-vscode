# Script Opcode 0x65: Reshow Left Speaker Figure

**Handler:** `$8C:DEB4`\
**Operands:** none\
**Reachability:** unused by original scripts (0 statically reachable instructions)\
**Confidence:** confirmed handler behavior

The handler loads X with `1` for the left speaker slot, calls `$8C:C627` using the entity already stored at `$7E:0B73`, and returns carry set. It does not change the stored entity. The dialogue helper handles portrait state and drawing.

The host-side model is [8CDEB4_opcode_65_reshow_left_speaker.c](../../../reconstructed-c/8C/8CDEB4_opcode_65_reshow_left_speaker.c). This opcode is unused by original scripts and is not included in the CDL-root progress count.