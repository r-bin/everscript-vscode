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
```assembly
; ==============================================================================
; Native NMI Vector Target ($00:FFEA holds $823A)
; ==============================================================================
$80:823A  5C 3E 82 80  JML $80823E     ; Jump to FastROM handler in Bank $80

; ==============================================================================
; Context Preservation & MMIO Acknowledgment
; ==============================================================================
$80:823E  C2 30        REP #$30        ; 16-bit A, 16-bit Index
$80:8240  8B           PHB             ; Save Data Bank
$80:8241  4B           PHK
$80:8242  AB           PLB             ; Data Bank = $80
$80:8243  48           PHA             ; Save Accumulator
$80:8244  DA           PHX             ; Save X
$80:8245  5A           PHY             ; Save Y
$80:8246  0B           PHD             ; Save Direct Page
$80:8247  A9 00 00     LDA #$0000
$80:824A  5B           TCD             ; Direct Page (D) = $0000
$80:824B  58           CLI             ; Re-enable IRQ (permits raster timers if active)
$80:824C  E2 10        SEP #$10        ; 8-bit Index

$80:824E  AE 10 42     LDX $4210       ; RDNMI: Acknowledge NMI (reading bit 7 clears latch)
$80:8251  A2 00        LDX #$00
$80:8253  8E 0C 42     STX $420C       ; HDMAEN = 0 (Disable HDMA during VBLANK)

$80:8256  AE 06 01     LDX $0106       ; Read PPU Display Control shadow ($7E:0106)
$80:8259  8E 00 21     STX $2100       ; INIDISP: Update brightness / screen blank state
```

### Part 2: VRAM Upload Queue Gate (`$0F3A`)
```assembly
$80:825C  AE 3A 0F     LDX $0F3A       ; Read VRAM Queue Lock flag ($7E0F3A)
$80:825F  D0 04        BNE $808265     ; If lock active ($0F3A != 0), SKIP VRAM UPLOADS!
$80:8261  A5 D9        LDA $D9         ; Read Frame DMA ready flag ($7E:00D9)
$80:8263  D0 03        BNE $808268     ; If frame data ready, process VRAM DMA transfers

$80:8265  4C 0C 83     JMP $80830C     ; Skip to PPU shadow register flush

; Process VRAM DMA Queue:
$80:8268  22 4A 83 80  JSL $80834A     ; Run queued VRAM tile and map uploads
```

### Part 3: PPU Shadow Register Flush (`$80:830C`)
```assembly
; ==============================================================================
; Flush PPU Shadows to Hardware Registers
; ==============================================================================
$80:830C  C2 30        REP #$30        ; 16-bit A, 16-bit Index
$80:830E  AD 0A 01     LDA $010A       ; VTIME shadow ($7E:010A)
$80:8311  8D 09 42     STA $4209       ; VTIMEL / VTIMEH
$80:8314  AD 08 01     LDA $0108       ; HTIME shadow ($7E:0108)
$80:8317  8D 07 42     STA $4207       ; HTIMEL / HTIMEH

$80:831A  E2 20        SEP #$20        ; 8-bit A for PPU byte registers
$80:831C  AD 1A 01     LDA $011A       ; BG3VOFS low byte
$80:831F  8D 13 21     STA $2113       ; BG3VOFS write 1
$80:8322  AD 1B 01     LDA $011B       ; BG3VOFS high byte
$80:8325  8D 13 21     STA $2113       ; BG3VOFS write 2

$80:8328  AD 1C 01     LDA $011C       ; BG3HOFS low byte
$80:832B  8D 14 21     STA $2114       ; BG3HOFS write 1
$80:832E  AD 1D 01     LDA $011D       ; BG3HOFS high byte
$80:8331  8D 14 21     STA $2114       ; BG3HOFS write 2

$80:8334  AD 16 01     LDA $0116       ; BG2VOFS low byte
$80:8337  8D 11 21     STA $2111       ; BG2VOFS write 1
$80:833A  AD 17 01     LDA $0117       ; BG2VOFS high byte
$80:833D  8D 11 21     STA $2111       ; BG2VOFS write 2

$80:8340  AD 18 01     LDA $0118       ; BG2HOFS low byte
$80:8343  8D 12 21     STA $2112       ; BG2HOFS write 1
$80:8346  AD 19 01     LDA $0119       ; BG2HOFS high byte
$80:8349  8D 12 21     STA $2112       ; BG2HOFS write 2

$80:834C  AD 12 01     LDA $0112       ; BG1VOFS low byte
$80:834F  8D 0F 21     STA $210F       ; BG1VOFS write 1
$80:8352  AD 13 01     LDA $0113       ; BG1VOFS high byte
$80:8355  8D 0F 21     STA $210F       ; BG1VOFS write 2

$80:8358  AD 14 01     LDA $0114       ; BG1HOFS low byte
$80:835B  8D 10 21     STA $2110       ; BG1HOFS write 1
$80:835E  AD 15 01     LDA $0115       ; BG1HOFS high byte
$80:8361  8D 10 21     STA $2110       ; BG1HOFS write 2

$80:8364  AD 0E 01     LDA $010E       ; BG4HOFS
$80:8367  8D 0D 21     STA $210D
$80:836A  AD 0F 01     LDA $010F
$80:836D  8D 0D 21     STA $210D

$80:8370  AD 10 01     LDA $0110       ; BG4VOFS
$80:8373  8D 0E 21     STA $210E
$80:8376  AD 11 01     LDA $0111
$80:8379  8D 0E 21     STA $210E

$80:837C  AD 22 01     LDA $0122
$80:837F  8D 23 21     STA $2123       ; W12SEL
$80:8382  AD 23 01     LDA $0123
$80:8385  8D 24 21     STA $2124       ; W34SEL
$80:8388  AD 24 01     LDA $0124
$80:838B  8D 25 21     STA $2125       ; WOBJSEL
```

### Part 4: Frame Counter & Controller Input Processing (`$80:8460`)
```assembly
; ==============================================================================
; Advance Frame Counter ($7E:0100 low word, $7E:0102 high word)
; ==============================================================================
$80:8460  C2 30        REP #$30        ; 16-bit A, 16-bit Index
$80:8462  EE 00 01     INC $0100       ; Increment lower 16-bit frame counter
$80:8465  D0 03        BNE $80846A     ; If no overflow, continue
$80:8467  EE 02 01     INC $0102       ; Increment upper 16-bit frame counter

; ==============================================================================
; Restore HDMA Configuration
; ==============================================================================
$80:846A  E2 20        SEP #$20        ; 8-bit A
$80:846C  A5 72        LDA $72         ; Read active HDMA channel mask ($7E:0072)
$80:846E  8D 0C 42     STA $420C       ; HDMAEN: Re-enable HDMA channels for active scan

; ==============================================================================
; Auto-Joypad Polling & Edge Detection
; ==============================================================================
$80:8471  A9 01        LDA #$01
$80:8473  2C 12 42     BIT $4212       ; HVBJOY: Check auto-joypad busy flag (Bit 0)
$80:8476  D0 FB        BNE $808473     ; Wait until joypad auto-read finishes!

$80:8478  C2 30        REP #$30        ; 16-bit A, 16-bit Index
$80:847A  AD C6 0E     LDA $0EC6       ; Previous frame's joypad state
$80:847D  4D 04 01     EOR $0104
$80:8480  49 FF FF     EOR #$FFFF
$80:8483  8D 04 01     STA $0104       ; Stored raw controller state

$80:8486  AD 16 40     LDA $4016       ; Joypad port read
$80:8489  AA           TAX
$80:848A  89 01 00     BIT #$0001
$80:848D  F0 05        BEQ $808494
$80:848F  AD 18 42     LDA $4218       ; JOY1L / JOY1H: Read Joypad 1 buttons
$80:8492  8D C6 0E     STA $0EC6       ; Store Joypad 1 buttons to $7E:0EC6

; ==============================================================================
; Context Restoration & Interrupt Return
; ==============================================================================
$80:8495  0B           PLD             ; Restore Direct Page
$80:8496  5A           PLY             ; Restore Y
$80:8497  DA           PLX             ; Restore X
$80:8498  68           PLA             ; Restore Accumulator
$80:8499  AB           PLB             ; Restore Data Bank
$80:84A0  40           RTI             ; Return from Interrupt!
```

---

## 3. Reconstructed C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

extern uint8_t  snes_rdnmi;      /* $4210 */
extern uint8_t  snes_hdmaen;     /* $420C */
extern uint8_t  snes_inidisp;    /* $2100 */
extern uint8_t  snes_hvbjoy;     /* $4212 */
extern uint16_t snes_joy1;       /* $4218 */

extern uint16_t g_ppu_shadow_0106; /* $7E:0106 */
extern uint16_t g_vram_lock_0f3a;  /* $7E:0F3A */
extern uint8_t  g_frame_ready_d9;  /* $7E:00D9 */
extern uint16_t g_frame_counter_lo;/* $7E:0100 */
extern uint16_t g_frame_counter_hi;/* $7E:0102 */
extern uint8_t  g_hdma_enable_72;  /* $7E:0072 */
extern uint16_t g_joypad1_current; /* $7E:0EC6 */
extern uint16_t g_joypad1_prev;    /* $7E:0104 */

void process_vram_upload_queue(void);
void flush_ppu_shadow_registers(void);

void nmi_handler(void) {
    /* 1. Acknowledge NMI interrupt */
    volatile uint8_t rdnmi = snes_rdnmi;
    (void)rdnmi;

    /* 2. Disable HDMA transfers during VBLANK */
    snes_hdmaen = 0x00;

    /* 3. Flush INIDISP screen brightness / display state */
    snes_inidisp = (uint8_t)g_ppu_shadow_0106;

    /* 4. Process VRAM DMA uploads only if lock is inactive and frame is ready */
    if (g_vram_lock_0f3a == 0 && g_frame_ready_d9 != 0) {
        process_vram_upload_queue(); /* $80:834A */
    }

    /* 5. Flush PPU scroll, window, and math register shadows */
    flush_ppu_shadow_registers(); /* $80:830C */

    /* 6. Increment 32-bit frame counter */
    g_frame_counter_lo++;
    if (g_frame_counter_lo == 0) {
        g_frame_counter_hi++;
    }

    /* 7. Re-enable HDMA channels for the upcoming frame */
    snes_hdmaen = g_hdma_enable_72;

    /* 8. Spin until auto-joypad read completes (HVBJOY bit 0) */
    while (snes_hvbjoy & 0x01) {
        /* Wait for SNES auto-joypad cycle (typically 3-4 scanlines) */
    }

    /* 9. Read controller 1 button states */
    g_joypad1_prev = g_joypad1_current;
    g_joypad1_current = snes_joy1;
}
```

