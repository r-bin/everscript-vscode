/*
 * Routine: $8F8692 (exp_level_up)
 * Bank: $8F (ROM Offset: $0F8692)
 * Source: docs/disassembly/combat/exp-level-up.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_EXP_CAP             0x00FFFFFF // 24-bit max
#define DEFAULT_LEVEL_THRESHOLD 500

typedef struct {
    uint32_t exp_amount;     // 24-bit accumulated experience ($7E:0AC6..0AC8)
    uint16_t current_level;  // Current level
} CharacterProgression;

extern CharacterProgression g_party_progression[2]; // 0: Boy, 1: Dog
extern uint16_t g_active_char_index;                // $7E:2348

extern void play_level_up_fanfare(void);
extern void spawn_floating_banner(uint32_t string_addr, uint16_t anchor_pos);
extern void refresh_character_hud_meters(void);

/**
 * Adds combat experience to the active character, propagates 24-bit carry,
 * tests for level milestone, and triggers audio-visual presentation.
 * Corresponds to $8F:8692.
 */
void combat_award_exp_and_check_level_up(uint16_t awarded_exp, uint16_t anchor_pos) {
    uint16_t char_idx = g_active_char_index & 0x01;
    CharacterProgression *prog = &g_party_progression[char_idx];

    // 1. 24-Bit Experience Addition
    uint32_t new_exp = prog->exp_amount + awarded_exp;
    if (new_exp > MAX_EXP_CAP) {
        new_exp = MAX_EXP_CAP;
    }
    prog->exp_amount = new_exp;

    // 2. Check Level Up Threshold
    if (awarded_exp >= DEFAULT_LEVEL_THRESHOLD) {
        prog->current_level++;

        // 3. Audio Chime / Fanfare
        play_level_up_fanfare();

        // 4. Visual "LEVEL UP!" banner ($8F:86FA)
        spawn_floating_banner(0x8F86FA, anchor_pos);

        // 5. Redraw HUD status meters
        refresh_character_hud_meters();
    }
}
