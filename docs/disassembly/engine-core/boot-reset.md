# Boot & Reset Handler Disassembly & Decompilation

- **ROM Location**: Bank `$80` (`$80:8020` – `$80:8236`) / FastROM mirror of Bank `$00` (`$00:8020` – `$00:8236`)
- **Native Interrupt Vector**: `$00:FFE0` (Emulation Reset Vector holds `$8020`)
- **Primary Function**: `reset_handler` (`$80:8020`)
- **Exit**: `JML $80:8B66` (jumps to `main_loop_entry`)

---

## 1. Sequence Overview

When the SNES CPU is powered on or reset:
1. The 65816 CPU starts in **6502 Emulation Mode** with interrupts disabled.
2. The reset vector fetches `$8020`.
3. The screen is immediately blanked (`$2100 = $8F`), preventing display noise.
4. The CPU switches to **65816 Native 16-bit Mode** (`CLC; XCE; REP #$30`).
5. The stack pointer is initialized to `$1FFF`, Direct Page is set to `$0000`, and Data Bank is set to `$80`.
6. All PPU hardware registers (`$2101`–`$2133`) and CPU registers (`$4200`–`$420D`) are initialized to safe zero or default states, except `$420D` = 1 at `$80:810C`: FastROM, so banks `$80`–`$FF` read in 6 master clocks (like internal cycles), WRAM in 8.
7. DMA Channel 0 performs fixed-source transfers from ROM offset `$80:8008` (containing `$00`) to wipe:
   - 64 KB VRAM (`$0000`–`$FFFF`)
   - 64 KB WRAM Bank `$7E` (`$7E:0000`–`$7E:FFFF`)
   - 64 KB WRAM Bank `$7F` (`$7F:0000`–`$7F:FFFF`)
8. Shadow PPU registers in RAM are initialized (`$0106 = $8F` for screen off, scroll offsets set to `$00FF`).
9. The 4-word 64-bit PRNG seed at `$0133`–`$0139` is initialized by latching the hardware PPU horizontal/vertical scan counters and XORing with classic programmer constants (`$DEAD`, `$63C7`, `$BABE`, `$E294`, `$BEEF`, `$5A0D`, `$FACE`, `$18BF`).
10. Hardware sub-systems (audio engine, graphics buffers) are initialized via calls to `$8C:8000`, `$80:B5B6`, `$8C:801F`, `$80:B72B`.
11. NMI interrupts and automatic joypad polling are enabled by writing `$81` to `$4200` (and saving to shadow mirror `$0E6B`).
12. The handler executes `JML $80:8B66` to enter the game main loop.

---

## 2. Disassembly & Annotations

### Phase A: 6502 Emulation Mode to 65816 Native Mode
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808020](soe://rom/code/808020?asm=1&c=0)


### Phase B: Wiping PPU & CPU Hardware Registers
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808020](soe://rom/code/808020?asm=1&c=0)


### Phase C: DMA Zeroing of VRAM and WRAM Banks $7E and $7F
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808020](soe://rom/code/808020?asm=1&c=0)


### Phase D: Initializing PPU Shadow Registers
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808020](soe://rom/code/808020?asm=1&c=0)


### Phase E: PRNG Seeding from Hardware Counters
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808020](soe://rom/code/808020?asm=1&c=0)


### Phase F: Interrupt Activation & Jump to Main Loop
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808020](soe://rom/code/808020?asm=1&c=0)


---

## 3. Reconstructed C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/808020_boot_reset.c`](../../../reconstructed-c/80/808020_boot_reset.c).
> [View in VFS: soe://rom/code/808020](soe://rom/code/808020?c=1&asm=0)


