/*
 * Routine: $80823A (opcode_joypad_fade)
 * Bank: $80 (ROM Offset: $00823A)
 * Source: docs/disassembly/script-vm/opcode-joypad-fade.md
 */

#include <stdint.h>
#include <stdbool.h>

#define WRAM_SCREEN_FADE_TARGET   (*(volatile uint16_t*)0x7E0B83)
#define WRAM_JOYPAD_EDGE_STATE    (*(volatile uint16_t*)0x7E0105)
#define WRAM_PPU_INIDISP_SHADOW   (*(volatile uint8_t*)0x7E0106)
#define DP_MUSIC_VOLUME_STEP      (*(volatile uint8_t*)0x9B)

extern uint16_t script_eval_expression(void);            // $8C:EA43
extern void     screen_sync_palette(void);               // $80:85D8
extern void     camera_center_and_clamp(void);           // $90:94AB
extern void     music_volume_step(void);                 // $8C:8619 (volume $9A += $9B, driver command $28)

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
