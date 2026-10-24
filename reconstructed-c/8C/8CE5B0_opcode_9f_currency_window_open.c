/*
 * Routine: $8C:E5B0 (script opcode 0x9F)
 * Source: docs/disassembly/script-vm/opcode-9f-currency-window-open.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t wram_read_word(uint16_t address);
extern void wram_write_word(uint16_t address, uint16_t value);
extern void initialize_window_record(uint16_t record); /* $8C:AC8A */
extern void load_window_graphics(uint16_t source, uint16_t destination); /* $90:817B */
extern uint16_t acquire_window_palette(uint16_t resource); /* $90:CE92 */

bool script_op_9f_currency_window_open(void) {
    wram_write_word(0x043F, 0x0000);
    wram_write_word(0x0441, 0x0000);
    wram_write_word(0x0439, 0x0004);
    wram_write_word(0x043B, 0x0001);
    wram_write_word(0x043D, 0x0000);
    wram_write_word(0x044B, 0x000D);
    wram_write_word(0x0449, 0x0014);
    wram_write_word(0x0451, 0x0008);
    wram_write_word(0x0453, 0x0002);
    wram_write_word(0x0455, 0x0010);
    wram_write_word(0x0459, 0x0000);
    wram_write_word(0x045D, 0x0000);
    wram_write_word(0x045B, 0x1924);
    wram_write_word(0x045F, 0x0001);

    initialize_window_record(0x0435);
    wram_write_word(0x0CB3, (uint16_t)(wram_read_word(0x0CB3) + 1));
    load_window_graphics(0x56E6, 0x0DEB);

    uint16_t palette_slot = acquire_window_palette(0xAACB);
    wram_write_word(0x0DF7, palette_slot);
    return true;
}