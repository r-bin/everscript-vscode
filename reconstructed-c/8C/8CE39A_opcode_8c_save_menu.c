/*
 * Routine: $8C:E39A (script opcode 0x8C)
 * Source: docs/disassembly/script-vm/opcode-8c-save-menu.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void enter_data_bank_80_preserving_current_bank(void);
extern void restore_preserved_data_bank(void);
extern void rom_call_8ee56a(void);
extern void rom_call_808fee(void);
extern void rom_call_80858c(void);
extern void rom_call_8caf23(void);
extern void rom_call_8cb743(void);
extern void rom_call_8dcf1a(void);
extern uint16_t script_fetch_u16(void); /* [$82], then INC $82 twice */
extern void rom_call_8ccd33(uint16_t string_key);
extern void rom_call_8dd303(void);
extern void rom_call_8ee08b(void);
extern void rom_call_9092c7(void);
extern void rom_call_8cab10(void);
extern uint16_t wram_read_word(uint16_t address);
extern void wram_write_word(uint16_t address, uint16_t value);
extern void rom_call_8f87fe(uint16_t x_value);

bool script_op_8c_save_menu(void) {
    enter_data_bank_80_preserving_current_bank();

    rom_call_8ee56a();
    rom_call_808fee();
    rom_call_80858c();
    rom_call_8caf23();
    rom_call_8cb743();
    rom_call_8dcf1a();

    uint16_t string_key = script_fetch_u16();
    rom_call_8ccd33(string_key);

    wram_write_word(0x0106, 0x0000);
    wram_write_word(0x0B83, 0x800F);
    rom_call_8dd303();

    rom_call_8ee56a();
    rom_call_808fee();
    rom_call_80858c();
    rom_call_8caf23();
    rom_call_8ee08b();
    rom_call_9092c7();
    rom_call_80858c();
    rom_call_8cab10();

    wram_write_word(0x143A, 0x0000);
    rom_call_8f87fe(wram_read_word(0x0F3E));
    wram_write_word(0x0106, 0x0000);
    wram_write_word(0x0B83, 0x800F);

    restore_preserved_data_bank();
    return true;
}