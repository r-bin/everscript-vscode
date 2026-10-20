# Script VM Screen Brightness Fading & Camera Synchronization

## Overview
During dialogue, scripted cutscenes, and room transitions, the *Secret of Evermore* Script VM uses a cluster of opcodes in bank `$8C` to control screen brightness fading (`$7E:0B83` / `$7E:0106`), center the camera on the active actor, and synchronize rendering.

- **Opcode `0x26` (`$8C:DC18`)**: `fade_in()` — Clears screen brightness to 0 black (`$7E:0106 = 0`), centers/clamps camera via `$90:94AB`, and sets target brightness to 15 (`$7E:0B83 = 0x800F`) to initiate stepped fade-in.
- **Opcode `0x27` (`$8C:DC10`)**: `fade_out()` — Sets target brightness to 0 black (`$7E:0B83 = 0x8000`) to initiate stepped fade-out.
- **Opcode `0x90` (`$8C:DC35`)**: `fade_to(level)` — Evaluates expression argument `E` (target brightness 0–15), centers camera, and sets `$7E:0B83 = 0x8000 | E`.
- **Opcode `0x91` (`$8C:DC56`)**: `set_brightness(level)` — Evaluates expression argument `E` and writes it directly to the PPU `INIDISP` shadow `$7E:0106` (instant brightness change without stepping).
- **Opcode `0x58` (`$8C:DC87`)**: `fade_in_screen()` — Stepped palette fade-in via DP `$9B = 0x10`.
- **Opcode `0x59` (`$8C:DC74`)**: `fade_out_screen()` — Stepped palette fade-out via DP `$9B = 0xF0`.

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
- `DP $9B`: Palette fade target brightness (`0x10` = full bright, `0xF0` = black).

---

## Engine Per-Frame Step Routine (`$80:DE95`)

Every frame during the main field update tick, the engine executes `$80:DE95`:

```assembly
; ==============================================================================
; $80:DE95 - Per-Frame Screen Fade Stepper
; ==============================================================================
$80:DE95  AD 83 0B    LDA $0B83         ; Load screen fade controller
$80:DE98  30 01       BMI .active       ; Bit 15 set: fade active
$80:DE9A  60          RTS               ; Otherwise, idle

.active:
$80:DE9B  E2 20       SEP #$20          ; 8-bit accumulator
$80:DE9D  AD 83 0B    LDA $0B83         ; Read target brightness (bits 0-3)
$80:DEA0  CD 06 01    CMP $0106         ; Compare with current INIDISP brightness
$80:DEA3  F0 18       BEQ .reached      ; Target reached?
$80:DEA5  10 0B       BPL .step_up      ; If target > current, increment

.step_down:
$80:DEA7  CE 06 01    DEC $0106         ; Current brightness -= 1
$80:DEAA  CD 06 01    CMP $0106         ; Target reached on this step?
$80:DEAD  F0 0E       BEQ .reached
$80:DEAF  C2 30       REP #$30
$80:DEB1  60          RTS

.step_up:
$80:DEB2  EE 06 01    INC $0106         ; Current brightness += 1
$80:DEB5  CD 06 01    CMP $0106         ; Target reached on this step?
$80:DEB8  F0 03       BEQ .reached
$80:DEBA  C2 30       REP #$30
$80:DEBC  60          RTS

.reached:
$80:DEBD  C2 30       REP #$30          ; 16-bit A/X
$80:DEBF  9C 83 0B    STZ $0B83         ; Clear fade controller (fade complete)
$80:DEC2  60          RTS
```

---

## Decompiled C Code

```c
#include <stdint.h>
#include <stdbool.h>

#define WRAM_SCREEN_FADE_TARGET   (*(volatile uint16_t*)0x7E0B83)
#define WRAM_JOYPAD_EDGE_STATE    (*(volatile uint16_t*)0x7E0105)
#define WRAM_PPU_INIDISP_SHADOW   (*(volatile uint8_t*)0x7E0106)
#define DP_FADE_TARGET_BRIGHTNESS (*(volatile uint8_t*)0x9B)

extern uint16_t script_eval_expression(void);            // $8C:EA43
extern void     screen_sync_palette(void);               // $80:85D8
extern void     camera_center_and_clamp(void);           // $90:94AB
extern void     palette_step_fade(void);                 // $8C:8619

/**
 * Shared camera centering and edge check helper for opcodes 0x26, 0x90, 0x91.
 */
static void script_fade_sync_camera(void) {
    uint16_t edge = WRAM_JOYPAD_EDGE_STATE;
    if ((int16_t)edge >= 0 && (edge & 0x0F00) == 0) {
        screen_sync_palette();
    }
    camera_center_and_clamp();
    WRAM_PPU_INIDISP_SHADOW = 0;
}

/**
 * $8C:DC10 - Script VM Opcode 0x27: fade_out()
 * Fades screen out to black (target brightness 0).
 */
bool script_op_fade_out(void) {
    WRAM_SCREEN_FADE_TARGET = 0x8000;
    return true; // SEC: Continue in same tick
}

/**
 * $8C:DC18 - Script VM Opcode 0x26: fade_in()
 * Clears brightness to 0, centers camera, and fades in to full brightness 15.
 */
bool script_op_fade_in(void) {
    script_fade_sync_camera();
    WRAM_SCREEN_FADE_TARGET = 0x800F;
    return true; // SEC: Continue in same tick
}

/**
 * $8C:DC35 - Script VM Opcode 0x90: fade_to(target_brightness)
 * Evaluates expression argument and fades to the specified brightness (0-15).
 */
bool script_op_fade_to(void) {
    script_fade_sync_camera();
    uint16_t level = script_eval_expression();
    WRAM_SCREEN_FADE_TARGET = 0x8000 | (level & 0x000F);
    return true; // SEC: Continue in same tick
}

/**
 * $8C:DC56 - Script VM Opcode 0x91: set_brightness(level)
 * Evaluates expression argument and writes directly to INIDISP shadow.
 */
bool script_op_set_brightness(void) {
    script_fade_sync_camera();
    uint16_t level = script_eval_expression();
    WRAM_PPU_INIDISP_SHADOW = (uint8_t)level;
    return true; // SEC: Continue in same tick
}
```
