# Script Opcode 0x26: Fade In

**Routine:** `$8C:DC18`\
**Range:** `$8C:DC18`–`$8C:DC34`\
**Confidence:** confirmed

## Behavior

The handler reads the joypad edge word at `$7E:0105`. It waits for a synchronized transition frame only when bit 15 is clear and bits 8–11 are all clear. It then centers and clamps the camera, sets the brightness shadow `$7E:0106` to zero, and writes `$800F` to the fade controller `$7E:0B83`, requesting a stepped fade toward brightness 15. Carry is set on return.

The host-side model is [8CDC18_opcode_26_fade_in.c](../../../reconstructed-c/8C/8CDC18_opcode_26_fade_in.c).

## Evidence

- Vanilla VFS at `$8C:DC18` tests `$0105` with `BMI`, then `BIT #$0F00`/`BNE` to decide whether to skip `$80:85D8`.
- The camera helper `$90:94AB` is always called; `$0106` is cleared and `$0B83` receives `$800F`.
- The routine ends with `SEC; RTS`; opcode table entry `$8C:E909` maps `0x26` here with no operands.