# Script Opcode 0x96: Teleport by Screen Offset

**Handler:** `$8C:E49D`–`$8C:E4B0`\
**Opcode table entry:** `$8C:E9E9`\
**Operands:** first screen-offset expression, second screen-offset expression\
**Confidence:** operand order, helper call, and return carry confirmed

## Control Flow

The handler evaluates the first expression and pushes its 16-bit result. It evaluates the
second expression and stores that result at `$10`, then pops the first result into `$0E`.
It calls `$90:A001` with these two stored offsets, sets carry, and returns, continuing the
current script turn.

Opcode metadata identifies the values as horizontal and vertical screen offsets. The
camera/entity movement implementation is documented separately at
[`90a001.md`](../../../src/games/evermore/localizations/knowledge/rom/90a001.md).

## Reconstruction

The host-side handler model is in
[`reconstructed-c/8C/8CE49D_opcode_96_teleport_screen.c`](../../../reconstructed-c/8C/8CE49D_opcode_96_teleport_screen.c).
The `$90:A001` movement helper remains opaque in this opcode-level model.

## Evidence and Boundaries

- The opcode table entry at `$8C:E9E9` selects `$8C:E49D`.
- `$8C:E49D` calls `$8C:EA43`; `$8C:E4A1` pushes its result.
- `$8C:E4A2` calls `$8C:EA43` again and `$8C:E4A6` stores the result at `$10`.
- `$8C:E4A8` pops the first result into `$0E`; `$8C:E4AB` calls `$90:A001`.
- `$8C:E4AF` sets carry before returning.