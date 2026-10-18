# Script VM Controller Locks, Button Masks & Palette Fading

## Overview
During dialogue, scripted cutscenes, and special interactions, the Secret of Evermore Script VM uses a dedicated cluster of opcodes in bank `$8C` to lock player joypad controls, restrict permitted button actions, and execute smooth palette brightness fades.

- **Opcode `0x27` (`$8C:DC10`)**: `lock_player_input()` — Disables all joypad input (`$7E:0B83 = 0x8000`).
- **Opcode `0x26` (`$8C:DC18`)**: `set_joypad_action_mask_default()` — Clears button overrides and restricts joypad input to basic dialogue confirmation (`$7E:0B83 = 0x800F`).
- **Opcode `0x90` (`$8C:DC35`)**: `set_joypad_action_mask(mask)` — Sets a customized joypad action mask (`$7E:0B83 = mask | 0x8000`).
- **Opcode `0x91` (`$8C:DC56`)**: `set_joypad_button_mask(mask)` — Sets explicit button filter mask in `$7E:0106`.
- **Opcode `0x58` (`$8C:DC87`)**: `fade_in_screen()` — Stepped palette fade-in to full brightness (`target = 0x10`).
- **Opcode `0x59` (`$8C:DC74`)**: `fade_out_screen()` — Stepped palette fade-out to black (`target = 0xF0`).

---

## Memory Map & Data Structures

### WRAM Controller & Screen Registers
- `$7E:0B83`: `joypad_control_mask`
  - Bit 15 (`0x8000`): Controller lock asserted
  - Bits 0-3 (`0x000F`): Permitted action buttons (B, Y, Select, Start)
- `$7E:0105`: `joypad_edge_state` (Controller newly pressed buttons high byte)
- `$7E:0106`: `joypad_button_override` (Explicit button filter register)
- `DP $9B`: `fade_target_brightness` (`0x10` = full bright, `0xF0` = black)

---

## Decompiled C Code

```c
#include <stdint.h>
#include <stdbool.h>

#define WRAM_JOYPAD_CONTROL_MASK   (*(volatile uint16_t*)0x7E0B83)
#define WRAM_JOYPAD_EDGE_STATE     (*(volatile uint16_t*)0x7E0105)
#define WRAM_JOYPAD_BUTTON_FILTER  (*(volatile uint16_t*)0x7E0106)
#define DP_FADE_TARGET_BRIGHTNESS  (*(volatile uint8_t*)0x9B)

// External Subroutines
extern uint16_t script_eval_expression(void);            // $8C:EA43
extern void     screen_sync_palette(void);                // $80:85D8
extern void     camera_center_and_clamp(void);            // $90:94AB
extern void     palette_step_fade(void);                  // $8C:8619

/**
 * Shared camera centering and joypad edge synchronization helper.
 */
static void script_joypad_sync(void) {
    uint16_t edge = WRAM_JOYPAD_EDGE_STATE;
    // If not in negative state and directional buttons are idle (mask 0x0F00 == 0)
    if ((int16_t)edge >= 0 && (edge & 0x0F00) == 0) {
        screen_sync_palette();
    }
    camera_center_and_clamp();
    WRAM_JOYPAD_BUTTON_FILTER = 0;
}

/**
 * $8C:DC10 - Script VM Opcode 0x27: lock_player_input()
 * Completely disables player joypad input processing.
 */
bool script_op_lock_player_input(void) {
    WRAM_JOYPAD_CONTROL_MASK = 0x8000;
    return true; // SEC: Continue same turn
}

/**
 * $8C:DC18 - Script VM Opcode 0x26: set_joypad_action_mask_default()
 * Sets default dialogue confirmation mask (0x800F) and clamps camera.
 */
bool script_op_set_joypad_action_mask_default(void) {
    script_joypad_sync();
    WRAM_JOYPAD_CONTROL_MASK = 0x800F;
    return true; // SEC: Continue same turn
}

/**
 * $8C:DC35 - Script VM Opcode 0x90: set_joypad_action_mask(mask)
 * Reads expression argument and sets customized joypad lock mask.
 */
bool script_op_set_joypad_action_mask(void) {
    script_joypad_sync();
    uint16_t mask = script_eval_expression();
    WRAM_JOYPAD_CONTROL_MASK = mask | 0x8000;
    return true; // SEC: Continue same turn
}

/**
 * $8C:DC56 - Script VM Opcode 0x91: set_joypad_button_mask(mask)
 * Reads expression argument and configures explicit button filter.
 */
bool script_op_set_joypad_button_mask(void) {
    script_joypad_sync();
    uint16_t mask = script_eval_expression();
    WRAM_JOYPAD_BUTTON_FILTER = mask;
    return true; // SEC: Continue same turn
}

/**
 * $8C:DC87 - Script VM Opcode 0x58: fade_in_screen()
 * Stepped palette fade-in to full display brightness.
 */
bool script_op_fade_in_screen(void) {
    DP_FADE_TARGET_BRIGHTNESS = 0x10; // Target brightness = 16
    palette_step_fade();
    return true; // SEC: Continue same turn
}

/**
 * $8C:DC74 - Script VM Opcode 0x59: fade_out_screen()
 * Stepped palette fade-out to complete black.
 */
bool script_op_fade_out_screen(void) {
    DP_FADE_TARGET_BRIGHTNESS = 0xF0; // Target brightness = 0
    palette_step_fade();
    return true; // SEC: Continue same turn
}
```
