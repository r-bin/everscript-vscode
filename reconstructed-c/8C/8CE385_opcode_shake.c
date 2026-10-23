/*
 * Routine: $8CE385 (opcode_shake)
 * Bank: $8C (ROM Offset: $0CE385)
 * Source: docs/disassembly/script-vm/opcode-shake.md
 */

#include <stdint.h>
#include <stdbool.h>

// Global direct page registers
extern uint8_t  g_shake_active_flag;      // DP $C3
extern int16_t  g_shake_jitter_offset_x;  // DP $C5
extern int16_t  g_shake_jitter_offset_y;  // DP $C7
extern uint16_t g_shake_duration_timer;   // DP $C9

// Extended WRAM registers
extern uint16_t g_shake_magnitude_x;      // $7E:2409
extern uint16_t g_shake_magnitude_y;      // $7E:240B
extern uint8_t  g_frame_counter_seed;     // $7E:0134

// Engine RNG
extern uint16_t rng_next_word(void);      // $80:859B

/**
 * screen_shake_stop ($90:988E)
 * Halts active screen tremors and zeroes all jitter offsets.
 */
void screen_shake_stop(void) {
    g_shake_active_flag = 0;
    g_shake_jitter_offset_x = 0;
    g_shake_jitter_offset_y = 0;
    g_shake_duration_timer = 0;
}

/**
 * screen_shake_start ($90:9897)
 * Starts screen tremor with a baseline magnitude of 4 pixels on both axes.
 */
void screen_shake_start(void) {
    g_shake_active_flag = 1;
    g_shake_magnitude_x = 4;
    g_shake_magnitude_y = 4;
}

/**
 * screen_shake_jitter ($90:98A5)
 * Runs per-frame hardware multiplication to generate random camera jitter
 * within [-magnitude, +magnitude].
 */
void screen_shake_jitter(void) {
    if (g_shake_active_flag == 0) {
        return;
    }

    // 1. Horizontal Jitter: RNG * (mag_x * 2 + 1) / 256 - mag_x
    uint8_t rng_val = (uint8_t)rng_next_word();
    uint8_t span_x = (uint8_t)((g_shake_magnitude_x << 1) + 1);
    uint16_t prod_x = (uint16_t)rng_val * (uint16_t)span_x;
    int16_t raw_x = (int16_t)(prod_x >> 8);
    g_shake_jitter_offset_x = raw_x - (int16_t)g_shake_magnitude_x;

    // 2. Vertical Jitter: FrameSeed * (mag_y * 2 + 1) / 256 - mag_y
    uint8_t span_y = (uint8_t)((g_shake_magnitude_y << 1) + 1);
    uint16_t prod_y = (uint16_t)g_frame_counter_seed * (uint16_t)span_y;
    int16_t raw_y = (int16_t)(prod_y >> 8);
    g_shake_jitter_offset_y = raw_y - (int16_t)g_shake_magnitude_y;
}

/**
 * script_op_8d ($8C:E385)
 * Script command to start or stop screen shake tremors.
 * 
 * @param script_pc Pointer to script instruction pointer.
 * @return Always returns true (Carry Set) to continue without yielding turn.
 */
bool script_op_8d(const uint8_t **script_pc) {
    uint8_t state = *(*script_pc)++;

    if (state == 0) {
        screen_shake_stop();
    } else {
        screen_shake_start();
    }

    return true; // Carry Set: continue turn
}
