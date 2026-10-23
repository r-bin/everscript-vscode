# Screen Shake, Palette Flash & Visual FX Pipeline

> **ROM Bank**: `$80` (Screen & PPU Driver)  
> **Source Routines**: `$80:A100` (`palette_transfer_stream_block`), `$80:A16E` (`palette_cgram_buffer_commit`)  
> **Related Routines**: `$80:A2E0` (`weather_tick_and_screen_shake`), `$80:823A` (`nmi_vblank_handler`)  
> **Hardware Registers**: SNES PPU `$2121` (CGADD - CGRAM Address), `$2122` (CGDATA - Color Data Write), `$2106` (MOSAIC)  
> **Memory Map**: `$7E:2435` (Screen shake intensity timer), `$7E:2437` (Screen shake vertical pixel offset), `$7E:7321`–`$7E:734F` (CGRAM shadow buffer)

---

## 1. Architectural Overview

Special visual effects in *Secret of Evermore*—earthquake screen tremors, damage flashes (red screen flash when struck), recovery auras, and color rotation—are driven by a synchronized PPU shadow pipeline in Bank `$80`. Because the SNES main CPU cannot write directly to CGRAM (Color RAM) during active display scanlines, color transformations are staged in WRAM shadow buffers (`$7E:7321`–`$7E:734F`) and transferred via DMA or loop streaming during Vertical Blanking (VBLANK).

### Key Subsystems:
1. **Palette Transfer Streaming (`$80:A100`)**:
   - Updates animated sub-palettes (e.g. glowing lava in Volcano, crystalline glows in Antiqua, and damage hit flashes).
   - Reads color sequences from ROM table pointers `$0007,y` and copies 16-color chunks into WRAM CGRAM shadow buffer `$7E:7339`–`$7E:734F`.
2. **CGRAM Commit Pipeline (`$80:A16E`)**:
   - Streamlines 16-color palette records into continuous arrays ready for VBLANK transfer.
   - Preserves transparency color 0 while shifting foreground and background shades.
3. **Screen Shake Oscillation & Decay Curve (`$80:A2E0`)**:
   - Screen tremors are governed by intensity counter `$7E:2435`.
   - Each frame, if `$7E:2435 > 0`:
     - The intensity counter decrements toward 0.
     - The engine computes an oscillating vertical offset: $\Delta y = \pm (\text{intensity} \pmod 4)$.
     - Stores the offset into `$7E:2437`, which the camera centering routine (`$90:94AB`) adds directly to the PPU BG Scroll register `$210E` (BG2VOFS).

---

## 2. 65816 Assembly Implementation

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/80A100](soe://rom/code/80A100?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/80A100_screen_effects.c`](../../../reconstructed-c/80/80A100_screen_effects.c).
> [View in VFS: soe://rom/code/80A100](soe://rom/code/80A100?c=1&asm=0)

