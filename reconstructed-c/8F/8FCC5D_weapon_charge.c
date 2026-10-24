/*
 * Routine: $8FCC5D (weapon_charge)
 * Bank: $8F (ROM Offset: $0FCC5D)
 * Source: docs/disassembly/combat/weapon-charge.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#define STAMINA_100_PCT         0x0400  /* 1024 = 100% stamina */
#define STAMINA_50_PCT          0x0200  /* 512 = 50% threshold */
#define STAMINA_200_PCT         0x0800  /* Level 2 charge attack */
#define STAMINA_300_PCT         0x0C00  /* Level 3 charge attack */

#define FLAG_NAME_PROFANITY_BIT 0x0020  /* $7E:22E9 bit 5 */

/**
 * Recharges entity stamina during frame tick ($8F:CC5D).
 *
 * @param current_stamina Current stamina points (0..1024+).
 * @param charge_speed    Stamina recharge points added this frame.
 * @return Updated stamina points clamped to 100% (or current charge level).
 */
uint16_t recharge_entity_stamina(uint16_t current_stamina, uint16_t charge_speed) {
    if (current_stamina >= STAMINA_100_PCT) {
        return current_stamina; // Natural regen stops at 100%
    }
    uint32_t next = (uint32_t)current_stamina + (uint32_t)charge_speed;
    if (next > STAMINA_100_PCT) {
        next = STAMINA_100_PCT;
    }
    return (uint16_t)next;
}

/**
 * Picks attack animation level based on current stamina gauge ($90:82D8).
 *
 * @param stamina Current entity stamina points.
 * @return Attack level index (0, 1, 2, or 3).
 */
uint8_t select_attack_level_by_stamina(uint16_t stamina) {
    if (stamina < STAMINA_100_PCT) {
        return 0; // Low-stamina jab (< 100%)
    } else if (stamina < STAMINA_200_PCT) {
        return 1; // Standard weapon attack (100%)
    } else if (stamina < STAMINA_300_PCT) {
        return 2; // Level 2 charge attack (200%)
    } else {
        return 3; // Level 3 maximum charge attack (300%)
    }
}

/**
 * Scales base attack damage according to stamina percentage ($8F:C02B).
 *
 * @param base_power Raw calculated attack power before stamina scaling.
 * @param stamina    Attacker's stamina gauge (0..1024).
 * @return Scaled effective attack power.
 */
uint16_t scale_damage_by_stamina(uint16_t base_power, uint16_t stamina) {
    if (stamina < STAMINA_50_PCT) {
        // Under 50% stamina: severe quarter-power penalty (chip damage)
        return (base_power >> 2);
    } else if (stamina < STAMINA_100_PCT) {
        // Between 50% and 99%: linear interpolation between 25% and 100%
        uint32_t fraction = stamina - STAMINA_50_PCT; // 0..511
        uint32_t bonus = ((uint32_t)base_power * fraction * 3) / (STAMINA_50_PCT * 4);
        return (uint16_t)((base_power >> 2) + bonus);
    } else if (stamina >= STAMINA_300_PCT) {
        // Level 3 charge: 3x power multiplier
        return base_power * 3;
    } else if (stamina >= STAMINA_200_PCT) {
        // Level 2 charge: 2x power multiplier
        return base_power * 2;
    }
    return base_power; // 100% stamina: normal 1x damage
}

static uint8_t uppercase_ascii(uint8_t value) {
    if (value >= 0x61 && value <= 0x7A) {
        return (uint8_t)(value - 0x20);
    }
    return value;
}

/**
 * Scans the null-terminated name at $80:B173 and sets bit 5 of $7E:22E9.
 * A failed candidate advances the scan start by one byte, allowing overlaps.
 *
 * @param str Null-terminated byte string read through the caller's DB pointer.
 * @param name_flags Word at $7E:22E9, updated only when a match is found.
 * @return True if the filtered sequence was found.
 */
bool check_name_profanity(const uint8_t *str, uint16_t *name_flags) {
    if (!str || !name_flags) return false;

    while (*str != 0) {
        static const uint8_t expected[] = { 0x46, 0x55, 0x43, 0x4B };
        bool match = true;

        for (size_t index = 0; index < sizeof(expected); index++) {
            const uint8_t value = str[index];
            if (value == 0) return false;
            if (uppercase_ascii(value) != expected[index]) {
                match = false;
                break;
            }
        }

        if (match) {
            *name_flags |= FLAG_NAME_PROFANITY_BIT;
            return true;
        }
        str++;
    }
    return false;
}
