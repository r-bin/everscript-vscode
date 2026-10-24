/*
 * Routine: $8C:D890 (script_op_44_47_open_message_box)
 * Source: docs/disassembly/script-vm/opcode-44-47-open-message-box.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint8_t bytes[0x2C];
} TextWindowRecord;

extern uint8_t script_fetch_u8(void);
extern uint16_t script_dispatch_table_offset(void);
extern TextWindowRecord *text_window_record_from_index(uint8_t index);
extern TextWindowRecord *text_default_window_record(void); /* $7E:034D */
extern uint16_t g_player_window_style; /* $7E:0B15 */
extern void text_window_lock_for_cutscene(void); /* $8C:C543 */
extern void text_window_build_frame(TextWindowRecord *window); /* $8C:AC8A */

static void window_write_word(TextWindowRecord *window,
                              uint8_t offset,
                              uint16_t value) {
    window->bytes[offset] = (uint8_t)value;
    window->bytes[offset + 1] = (uint8_t)(value >> 8);
}

static uint16_t window_read_word(const TextWindowRecord *window,
                                 uint8_t offset) {
    return (uint16_t)(window->bytes[offset] |
                      ((uint16_t)window->bytes[offset + 1] << 8));
}

bool script_op_44_47_open_message_box(void) {
    text_window_lock_for_cutscene();
    uint8_t window_index = script_fetch_u8();
    TextWindowRecord *window = text_window_record_from_index(window_index);

    uint8_t first = script_fetch_u8();
    uint8_t second = script_fetch_u8();
    uint8_t third = script_fetch_u8();
    uint8_t fourth = script_fetch_u8();

    window_write_word(window, 0x16, first);
    window_write_word(window, 0x14, second);
    window_write_word(window, 0x1C, third);
    window_write_word(window, 0x1E, fourth);
    window_write_word(window, 0x20, (uint16_t)fourth << 3);
    window_write_word(window, 0x28, 0);

    bool transparent_centered = script_dispatch_table_offset() == 0x008E;
    window_write_word(window, 0x26,
                      transparent_centered ? 0x1924 : g_player_window_style);
    window_write_word(window, 0x2A, transparent_centered ? 1 : 0);
    window_write_word(window, 0x0A, 0);

    window_write_word(window, 0x06, 1);
    window_write_word(window, 0x08, 0);
    window_write_word(window, 0x04, 4);
    window_write_word(window, 0x0C, 0);
    text_window_build_frame(window);

    uint16_t flags = window_read_word(window, 0x12);
    window_write_word(window, 0x12,
                      flags | (transparent_centered ? 0x0010 : 0));
    return true;
}

bool script_op_48_4b_open_default_message_box(void) {
    text_window_lock_for_cutscene();
    TextWindowRecord *window = text_default_window_record();

    window_write_word(window, 0x14, 2);
    window_write_word(window, 0x16, 2);
    window_write_word(window, 0x1C, 0x001C);
    window_write_word(window, 0x1E, 0x000A);
    window_write_word(window, 0x20, 0x0050);
    window_write_word(window, 0x28, 0);
    window_write_word(window, 0x26, g_player_window_style);
    window_write_word(window, 0x2A, 0);
    window_write_word(window, 0x06, 1);
    window_write_word(window, 0x08, 0);
    window_write_word(window, 0x04, 4);
    window_write_word(window, 0x0C, 0);
    window_write_word(window, 0x0A, 0);
    text_window_build_frame(window);

    uint16_t flags = window_read_word(window, 0x12);
    window_write_word(window, 0x12, flags);
    return true;
}