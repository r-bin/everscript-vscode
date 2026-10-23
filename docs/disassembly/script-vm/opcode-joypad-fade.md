# Script VM Screen Brightness Fading & Camera Synchronization

## Overview
During dialogue, scripted cutscenes, and room transitions, the *Secret of Evermore* Script VM uses a cluster of opcodes in bank `$8C` to control screen brightness fading (`$7E:0B83` / `$7E:0106`), center the camera on the active actor, and synchronize rendering.

What each opcode does is described once, on its opcode page; this file keeps the routines' code: [`0x26` fade_in](soe://rom/assets/scripts/opcodes/26.md), [`0x27` fade_out](soe://rom/assets/scripts/opcodes/27.md), [`0x90` fade_to](soe://rom/assets/scripts/opcodes/90.md), [`0x91` set_brightness](soe://rom/assets/scripts/opcodes/91.md), [`0x58` music_fade_in](soe://rom/assets/scripts/opcodes/58.md), [`0x59` music_fade_out](soe://rom/assets/scripts/opcodes/59.md).

---

## Memory Map & Registers

### WRAM Screen Brightness Registers
- `$7E:0B83`: `SCREEN_FADE_TARGET`
  - Bit 15 (`0x8000`): Fade transition active.
  - Bits 0–3 (`0x000F`): Target brightness level (0 = black, 15 = full brightness `$0F`).
- `$7E:0106`: `PPU_SHADOW` (`INIDISP` shadow for SNES hardware register `$2100`)
  - Bits 0–3: Current display brightness (0–15).
  - Bit 7: Forced blanking flag.
  - Copied to hardware register `$2100` on every VBLANK / NMI interrupt (`$80:823A`).
- `$7E:0105`: `joypad_edge_state` (High byte of newly pressed controller buttons).
- `DP $9B`: music volume step for `$8C:8619` (`0x10` up, `0xF0` down); `DP $9A` the music volume. Not a screen fade.

---

## Engine Per-Frame Step Routine (`$80:DE95`)

Every frame during the main field update tick, the engine executes `$80:DE95`:

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/80823A](soe://rom/code/80823A?asm=1&c=0)


---

## Decompiled C Code

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/80823A_opcode_joypad_fade.c`](../../../reconstructed-c/80/80823A_opcode_joypad_fade.c).
> [View in VFS: soe://rom/code/80823A](soe://rom/code/80823A?c=1&asm=0)

