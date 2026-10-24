/*
 * Routine: $8C:E17A (opcode 0x7F)
 * Source: docs/disassembly/script-vm/opcode-7f-name-entry.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_fetch_u16(void); /* [$82], advance by two */
extern uint16_t rom_read_word_long(uint32_t address);
extern uint8_t rom_read_byte_long(uint32_t address);
extern uint16_t wram_read_word(uint16_t address);
extern void wram_write_word(uint16_t address, uint16_t value);
extern void script_vm_write_dp_word(uint16_t offset, uint16_t value);

extern void rom_call_8ee56a(void);
extern void rom_call_808fee(void);
extern void rom_call_80858c(void);
extern void rom_call_8caf23(void);
extern void rom_call_8cb743(void);
extern void rom_call_8d8000(void);
extern void rom_call_80b149(void);
extern void rom_call_8d82cb(void);
extern void rom_call_8ee08b(void);
extern void rom_call_9092c7(void);
extern void rom_call_8cab10(void);
extern void rom_call_8f87fe(uint16_t x_value);

bool script_op_7f_name_entry(void) {
    rom_call_8ee56a();
    rom_call_808fee();
    rom_call_80858c();
    rom_call_8caf23();
    rom_call_8cb743();
    rom_call_8d8000();

    wram_write_word(0x0106, 0);
    wram_write_word(0x0B83, 0x800F);

    uint16_t selector = script_fetch_u16();
    uint16_t name_buffer = rom_read_word_long(0x8CE1FDUL + selector);
    uint8_t descriptor = rom_read_byte_long(0x8CE1FFUL + selector);
    script_vm_write_dp_word(0x0022, name_buffer);
    script_vm_write_dp_word(0x0024, descriptor);

    if (name_buffer == 0x2234) {
        script_vm_write_dp_word(0x0026, 0x60AC);
        script_vm_write_dp_word(0x0028, 0x00C4);
        rom_call_80b149();
    }

    rom_call_8d82cb();
    rom_call_8ee56a();
    rom_call_808fee();
    rom_call_8caf23();
    rom_call_8ee08b();
    rom_call_9092c7();
    rom_call_80858c();
    rom_call_8cab10();

    rom_call_8f87fe(wram_read_word(0x0F3E));
    wram_write_word(0x0106, 0);
    wram_write_word(0x0B83, 0x800F);
    return true;
}