/*
 * Routine: $8F:BA06-$8F:BAAE (melee hit-chance roll)
 * $8F:BA27 is an interior address, not a separate call entry.
 * Source: docs/disassembly/combat/projectile-homing.md
 */

#include <stdbool.h>
#include <stdint.h>

#define HIT_POINTER_TABLE 0xBAAFu
#define BOY_RECORD        0x0A26u
#define DOG_RECORD        0x0A70u

typedef struct {
    uint16_t attacker_entity_address; /* Direct-page $4C */
    uint16_t target_entity_address;   /* Y at routine entry */
    uint16_t word_0f42;
    uint16_t word_2262;
    uint16_t attacker_record_address; /* Attacker entity +$60 */
    uint16_t attacker_field_14;
    uint16_t attacker_field_16;
    uint16_t attacker_record_flags_07;
    uint16_t attacker_hit_rate_21;
    uint16_t target_evade_1f;
    uint16_t target_field_12;
    uint16_t target_field_36;
    uint16_t target_field_38;
} HitRollState;

extern uint16_t rom_read_word_bank_8f(uint16_t address);
extern uint16_t rng_word_80859b(void);

bool melee_hit_chance_roll_8fba06(HitRollState *state) {
    state->attacker_field_16 |= 0x0010;
    state->attacker_field_14 &= 0xFDFF;
    state->target_field_36 = state->attacker_entity_address;
    state->target_field_38 = 0x0014;

    uint16_t hit_word = (uint16_t)(state->attacker_hit_rate_21 + 1u);
    bool use_minus_30_path =
        (uint16_t)(state->target_entity_address ^ 0x01BE) == state->word_0f42 &&
        (state->attacker_record_flags_07 & 0x0002) != 0;

    if (use_minus_30_path) {
        hit_word = (uint16_t)(state->attacker_hit_rate_21 - 29u);
    }

    if (state->attacker_record_address != BOY_RECORD &&
        state->attacker_record_address != DOG_RECORD &&
        (state->word_2262 & 0x0020) != 0) {
        hit_word = (uint16_t)(hit_word - 10u);
        if ((int16_t)hit_word < 0) {
            hit_word = 0;
        }
    }

    if ((int16_t)hit_word < 0) {
        hit_word = 0;
    } else if (hit_word >= 100) {
        hit_word = 100;
    }

    uint16_t evade_plus_one = (uint16_t)(state->target_evade_1f + 1u);
    uint16_t row_byte_offset =
        (uint16_t)(((evade_plus_one >> 1) & 0xFFFEu));
    uint16_t row_address = rom_read_word_bank_8f(
        (uint16_t)(HIT_POINTER_TABLE + row_byte_offset));
    uint16_t column_byte_offset =
        (uint16_t)((hit_word & 0xFFFCu) >> 1);
    uint16_t threshold = rom_read_word_bank_8f(
        (uint16_t)(row_address + column_byte_offset));

    if (threshold != 0 && (rng_word_80859b() & 0x7FFFu) < threshold) {
        return true;
    }

    state->target_field_12 |= 0x0040;
    return false;
}