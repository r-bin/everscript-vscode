# Script Opcode 0x27: Fade Out

**Routine:** `$8C:DC10`\
**Range:** `$8C:DC10`–`$8C:DC17`\
**Confidence:** confirmed

## Behavior

The handler writes `$8000` to the screen fade controller at `$7E:0B83`, requesting a stepped fade toward brightness zero. It returns carry set for same-turn continuation.

The host-side model is [8CDC10_opcode_27_fade_out.c](../../../reconstructed-c/8C/8CDC10_opcode_27_fade_out.c).

## Evidence

- Vanilla VFS at `$8C:DC10` loads `$8000`, stores it to `$0B83`, then returns with `SEC; RTS`.
- Opcode table entry `$8C:E90B` maps `0x27` here with no operands. The frame-loop routine `$80:DE95` consumes this controller value to step brightness down to zero.