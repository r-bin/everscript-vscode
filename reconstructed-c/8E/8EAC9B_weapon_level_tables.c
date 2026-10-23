/*
 * Routine: $8EAC9B (weapon_level_tables)
 * Bank: $8E (ROM Offset: $0EAC9B)
 * Source: docs/disassembly/ui/weapon-level-tables.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_WEAPON_TIERS 16

// Master skill threshold requirements table ($C4:5B4A)
extern const uint16_t g_weapon_xp_thresholds[MAX_WEAPON_TIERS]; // [0, 30, 50, 70, 100, 120, 140, ...]

typedef struct {
    uint16_t current_xp;       // $7E:0AC6,x
    uint16_t current_level;    // $7E:0AC8,x
    uint16_t target_threshold; // $7E:0BF5
} WeaponMasteryState;

extern WeaponMasteryState g_weapon_mastery[4]; // Swords, Axes, Spears, Bazookas

extern void format_number_string(uint16_t value, char *out_buf);
extern void render_status_text(const char *text);

/**
 * Looks up the required experience threshold for the weapon category,
 * stores it to $0BF5, and formats the numeric text for the status menu.
 * Corresponds to $8E:AC9B.
 */
void weapon_skill_threshold_lookup(uint8_t category_idx, char *text_buffer) {
    if (category_idx >= 4) category_idx = 0;

    WeaponMasteryState *mastery = &g_weapon_mastery[category_idx];
    uint16_t level = mastery->current_level;
    if (level >= MAX_WEAPON_TIERS) level = MAX_WEAPON_TIERS - 1;

    // Load required XP milestone from $C4:5B4A
    uint16_t threshold = g_weapon_xp_thresholds[level];
    mastery->target_threshold = threshold;

    // Format string into WRAM buffer $7E:2FF4 and render to status screen
    format_number_string(threshold, text_buffer);
    render_status_text(text_buffer);
}
