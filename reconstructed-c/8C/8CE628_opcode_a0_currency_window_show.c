/*
 * Routine: $8C:E628 (script opcode 0xA0)
 * Source: docs/disassembly/script-vm/opcode-a0-currency-window-show.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t wram_read_byte(uint16_t address);
extern uint16_t wram_read_word(uint16_t address);
extern void refresh_window(uint16_t record); /* $8C:AF2B */
extern void format_currency_amount(
    uint8_t low_byte,
    uint8_t high_byte,
    uint16_t destination,
    uint8_t destination_bank
); /* $80:B21F; output buffer $7E:2FF4 */
extern void expand_window_text_tokens(uint16_t record); /* $8C:9E03 */

bool script_op_a0_currency_window_show(void) {
    refresh_window(0x0435);

    uint8_t currency_index = (uint8_t)wram_read_word(0x2348);
    uint8_t low_byte = wram_read_byte((uint16_t)(0x0AC6 + currency_index));
    uint8_t high_byte = wram_read_byte((uint16_t)(0x0AC8 + currency_index));
    format_currency_amount(low_byte, high_byte, 0x2FF4, 0x7E);
    expand_window_text_tokens(0x0435);
    return true;
}