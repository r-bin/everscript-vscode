/*
 * Routine: $8C89DF (entity_name_text)
 * Bank: $8C (ROM Offset: $0C89DF)
 * Source: docs/disassembly/ui/entity-name-text.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <string.h>

/* Target modal flags ($7E:05AD) */
#define TARGET_FLAG_MULTI_TARGET   0x0001
#define TARGET_FLAG_REDRAW_BANNER  0x0100

/* Staging text buffer offsets */
#define WINDOW_BUFFER_TARGET_NAME  0x034D
#define WINDOW_BUFFER_STATUS_CARD  0x0379
#define BUFFER_DECIMAL_CONVERT     0x2FF4

/* Character record field offsets in Bank $8E */
#define RECORD_NAME_PTR_OFFSET     0x00
#define RECORD_ATTACK_OFFSET       0x19
#define RECORD_DEFENSE_OFFSET      0x1B
#define RECORD_EVADE_OFFSET        0x1F
#define RECORD_HIT_RATE_OFFSET     0x21

/* String literals embedded in Bank $8C */
static const char STRING_MULTIPLE[] = "Multiple";
static const char STRING_ONE_LIFE_ONLY[] = "I can only talk about one life at a time!";
static const char STRING_LABEL_HP[] = "HP: ";
static const char STRING_LABEL_ATTACK[] = "Attack: ";
static const char STRING_LABEL_DEFEND[] = "Defend: ";
static const char STRING_LABEL_HIT_PCT[] = "Hit %: ";
static const char STRING_LABEL_EVADE_PCT[] = "Evade %: ";

/* External engine functions */
extern void dialogue_string_copy_raw_name(uint16_t buffer_offset, const char *source_str);
extern void dialogue_format_and_append_line(uint16_t buffer_offset, const char *line_str);
extern void dialogue_append_char(uint16_t buffer_offset, uint16_t character_code);
extern void int_to_dec_string(uint16_t value, char *out_buffer);
extern uint8_t *rom_bank_8e_ptr(uint16_t offset);

/**
 * Streams the active target actor's name into the dialogue window target banner.
 *
 * Address: $8C:89DF - $8C:8A1B
 *
 * @param modal_flags       Contents of $7E:05AD (targeting state)
 * @param cursor_entity_ptr Pointer to selected target entity in $7E:0000+
 */
void dialogue_stream_target_actor_name(uint16_t modal_flags, const uint8_t *target_entity) {
    const char *name_ptr = NULL;

    if (modal_flags & TARGET_FLAG_MULTI_TARGET) {
        /* Multi-target mode: display generic "Multiple" label */
        name_ptr = STRING_MULTIPLE;
    } else {
        if (target_entity != NULL) {
            /* Entity struct +0x60 holds 16-bit offset of character record in Bank $8E */
            uint16_t record_offset = *(const uint16_t *)(target_entity + 0x60);
            const uint8_t *record = rom_bank_8e_ptr(record_offset);

            /* Character record +0x00 holds 24-bit pointer to character name string */
            uint32_t name_addr = *(const uint32_t *)(record + RECORD_NAME_PTR_OFFSET) & 0x00FFFFFF;

            if ((name_addr >> 16) == 0x7E) {
                /* Boy / Dog mutable name buffer in WRAM ($7E:2400 / $7E:2420) */
                name_ptr = (const char *)(uintptr_t)name_addr;
            } else {
                /* NPC / Monster fixed name in ROM */
                name_ptr = (const char *)rom_bank_8e_ptr(name_addr & 0xFFFF);
            }
        }
    }

    if (name_ptr != NULL) {
        /* Set Bank $80 and stream into target name banner buffer */
        dialogue_string_copy_raw_name(WINDOW_BUFFER_TARGET_NAME, name_ptr);
        dialogue_format_and_append_line(WINDOW_BUFFER_TARGET_NAME, name_ptr);
    }
}

/**
 * Formats and renders a complete vital statistics card for an entity
 * into the inspection text window (used by Oracle / Fortune Teller NPCs).
 *
 * Address: $8C:8A25 - $8C:8B79
 *
 * @param modal_flags   Contents of $7E:05AD
 * @param target_entity Pointer to selected target entity in WRAM
 */
void oracle_render_target_stats_card(uint16_t modal_flags, const uint8_t *target_entity) {
    if (modal_flags & TARGET_FLAG_MULTI_TARGET) {
        /* Life inspector only evaluates one creature at a time */
        dialogue_string_copy_raw_name(WINDOW_BUFFER_STATUS_CARD, STRING_ONE_LIFE_ONLY);
        dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_ONE_LIFE_ONLY);
        return;
    }

    if (target_entity == NULL) {
        return;
    }

    char dec_buffer[16];

    /* 1. Header: Entity Name */
    uint16_t record_offset = *(const uint16_t *)(target_entity + 0x60);
    const uint8_t *record = rom_bank_8e_ptr(record_offset);
    uint32_t name_addr = *(const uint32_t *)(record + RECORD_NAME_PTR_OFFSET) & 0x00FFFFFF;
    const char *name_ptr = (const char *)(uintptr_t)name_addr;

    dialogue_string_copy_raw_name(WINDOW_BUFFER_STATUS_CARD, name_ptr);

    /* 2. Current HP ($7E:002A,X) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_HP);
    uint16_t current_hp = *(const uint16_t *)(target_entity + 0x2A);
    int_to_dec_string(current_hp, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
    dialogue_append_char(WINDOW_BUFFER_STATUS_CARD, 0x000A); /* Newline */

    /* 3. Base Attack (Record +$19) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_ATTACK);
    uint16_t attack = *(const uint16_t *)(record + RECORD_ATTACK_OFFSET);
    int_to_dec_string(attack, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
    dialogue_append_char(WINDOW_BUFFER_STATUS_CARD, 0x000A);

    /* 4. Base Defense (Record +$1B) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_DEFEND);
    uint16_t defense = *(const uint16_t *)(record + RECORD_DEFENSE_OFFSET);
    int_to_dec_string(defense, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
    dialogue_append_char(WINDOW_BUFFER_STATUS_CARD, 0x000A);

    /* 5. Base Hit Rate (Record +$21) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_HIT_PCT);
    uint16_t hit_pct = *(const uint16_t *)(record + RECORD_HIT_RATE_OFFSET);
    int_to_dec_string(hit_pct, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
    dialogue_append_char(WINDOW_BUFFER_STATUS_CARD, 0x000A);

    /* 6. Base Evade Rate (Record +$1F) */
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, STRING_LABEL_EVADE_PCT);
    uint16_t evade_pct = *(const uint16_t *)(record + RECORD_EVADE_OFFSET);
    int_to_dec_string(evade_pct, dec_buffer);
    dialogue_format_and_append_line(WINDOW_BUFFER_STATUS_CARD, dec_buffer);
}
