# Ring Menu Orbit Physics & Interactive Continuous Rotation

## Overview
When navigating the ring menu in Secret of Evermore, pressing Left or Right on the D-Pad triggers an orbital rotation. Rather than instantly snapping to the newly selected item, the engine calculates the target angle using SNES hardware math registers, steps the visual angle by 4 angular units per frame, synchronizes rendering with VBlank, plays tick audio cues, and handles continuous auto-rotation if the directional button remains held down.

---

## Memory Map & Hardware Registers

### WRAM Variables
- `$7E:061B`: `current_orbit_angle` (Visual orbital angle, 0x00 - 0xFF)
- `$7E:061D`: `target_orbit_angle` (Destination angle calculated for the active item)
- `$7E:05AB`: `ring_active_modal` (Bit 0: circular window clipping active)
- `$7E:0104`: `controller_hold` (Bit 8: Left D-pad, Bit 9: Right D-pad)
- `DP $95`: Pointer to current `RingCategoryHeader`
  - `+0x00`: `item_count`
  - `+0x02`: `active_index`

### SNES Hardware Registers
- `$00:4202`: `WRNUMA` (8-bit multiplier input A)
- `$00:4204`: `WRDIVL` (16-bit dividend input)
- `$00:4206`: `WRDIVB` (8-bit divisor input)
- `$00:4214`: `RDDIVL` (16-bit quotient output)
- `$00:4216`: `RDMPY` / `RDMOD` (16-bit remainder / multiplication product)

---

## Decompiled C Code

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/90/9080D2_ring_menu_rotation.c`](../../../reconstructed-c/90/9080D2_ring_menu_rotation.c).
> [View in VFS: soe://rom/code/9080D2](soe://rom/code/9080D2?c=1&asm=0)

