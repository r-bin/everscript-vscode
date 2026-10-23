# NMI (V-Blank) Interrupt Handler Disassembly & Decompilation

- **ROM Location**: Bank `$80` (`$80:823A` – `$80:84A0`) / Vector stub at `$00:823A`
- **Native Interrupt Vector**: `$00:FFEA` (Holds `$823A`)
- **Primary Function**: `nmi_handler` (`$80:823E`)
- **Exit**: `RTI` (`$80:84A0`)

---

## 1. Architectural Overview

The Non-Maskable Interrupt (NMI) fires precisely at scanline 225 at the start of each NTSC vertical blanking interval. The CPU must perform all time-sensitive video memory operations (VRAM tile DMA, OAM sprite attribute uploads, CGRAM palette updates, and PPU register writes) within the narrow ~1.3 millisecond VBLANK window before active raster scanning resumes.

Secret of Evermore's NMI routine executes the following sequence:
1. **Context Preservation**: Pushes Bank (`B`), Data Page (`D`), and CPU registers (`A`, `X`, `Y`) to stack.
2. **Interrupt Acknowledgment**: Reads `$4210` (`RDNMI`) to clear the hardware NMI latch.
3. **HDMA Suppression**: Immediately clears `$420C` (`HDMAEN = 0`) to prevent HDMA from colliding with CPU-driven DMA during VBLANK.
4. **Display Control**: Updates `$2100` (`INIDISP`) from WRAM shadow `$0106`.
5. **VRAM Upload Queue Dispatch**:
   - Checks `$0F3A`: If non-zero (set during camera scroll calculations or screen reset), VRAM uploads are **completely skipped** to protect VRAM integrity against partial writes.
   - If `$0F3A == 0` and `$D9 != 0` (frame buffer ready), processes queued VRAM tile transfers.
6. **PPU Shadow Register Flush**: Copies shadow scroll positions and window parameters (`$0108`–`$0125`) to SNES PPU MMIO registers (`$210D`–`$2125`).
7. **Palette Updates**: Flushes dirty CGRAM palette entries.
8. **Frame Counter Progression**: Increments the 32-bit frame counter (`$0100` low word, `$0102` high word).
9. **HDMA Reactivation**: Restores active HDMA channels from shadow `$72` into `$420C`.
10. **Auto-Joypad Capture**: Waits for hardware auto-joypad reading to complete (`$4212` bit 0), reads `$4218`, computes button-down edge triggers, and updates `$0EC6` / `$0104`.
11. **Context Restoration**: Pulls registers and returns via `RTI`.

---

## 2. Disassembly & Annotations

### Part 1: Interrupt Entry & Vector Dispatch
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/80823A](soe://rom/code/80823A?asm=1&c=0)


### Part 2: VRAM Upload Queue Gate (`$0F3A`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/80823A](soe://rom/code/80823A?asm=1&c=0)


### Part 3: PPU Shadow Register Flush (`$80:830C`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/80823A](soe://rom/code/80823A?asm=1&c=0)


### Part 4: Frame Counter & Controller Input Processing (`$80:8460`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/80823A](soe://rom/code/80823A?asm=1&c=0)


---

## 3. Reconstructed C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/80823A_nmi_vblank.c`](../../../reconstructed-c/80/80823A_nmi_vblank.c).
> [View in VFS: soe://rom/code/80823A](soe://rom/code/80823A?c=1&asm=0)


