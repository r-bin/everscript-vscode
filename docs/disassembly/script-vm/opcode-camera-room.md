# Script VM Camera Positioning, Map Transitions & Character Spawning

## Overview
Three opcodes place the party: `0x20` in the room, `0x21` restarting the room, `0x22` loading another map; all three end in `$8F:B434`.

What each opcode does is described once, on its opcode page; this file keeps the routines' code: [`0x20` teleport_party](soe://rom/assets/scripts/opcodes/20.md), [`0x21` restart_room_at](soe://rom/assets/scripts/opcodes/21.md), [`0x22` load_map](soe://rom/assets/scripts/opcodes/22.md).

---

## Memory Map & Data Structures

### Direct Page Variables
- `DP $44`: Target Z elevation (cleared to 0 during 2D warp)
- `DP $46`: Target X coordinate in pixels
- `DP $48`: Target Y coordinate in pixels
- `DP $4C`: Entity pointer passed to position routines
- `DP $80`: Script thread yield frame counter (`0xFFFE` = yield 2 frames)
- `DP $82`: Script bytecode instruction pointer (PC)
- `DP $83`: Script thread execution control flags

### WRAM Globals
- `$7E:0ADB`: Target room / map ID
- `$7E:0F3E`: Boy entity pointer
- `$7E:0F40`: Dog entity pointer

---

## Decompiled C Code

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FB434_opcode_camera_room.c`](../../../reconstructed-c/8F/8FB434_opcode_camera_room.c).
> [View in VFS: soe://rom/code/8FB434](soe://rom/code/8FB434?c=1&asm=0)

