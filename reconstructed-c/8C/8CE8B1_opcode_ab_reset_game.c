/*
 * Routine: $8C:E8B1 (script opcode 0xAB)
 * Reset sequence: $80:84C9
 * Source: docs/disassembly/script-vm/opcode-ab-reset-game.md
 */

#include <stdint.h>

extern void snes_write_io8(uint16_t address, uint8_t value);
extern void current_db_write8(uint16_t address, uint8_t value);
extern void cpu_set_stack_pointer(uint16_t value);
extern void cpu_push_word(uint16_t value);
extern void cpu_disable_interrupts(void);
extern _Noreturn void cpu_jump_long(uint32_t address);

_Noreturn void script_op_ab_reset_game(void) {
    snes_write_io8(0x2100, 0x50);
    snes_write_io8(0x4200, 0x00);
    current_db_write8(0x0E65, 0x00);
    current_db_write8(0x0E6B, 0x00);
    snes_write_io8(0x420C, 0x00);

    cpu_set_stack_pointer(0x1FFF);
    cpu_push_word(0x0001);
    cpu_disable_interrupts();
    cpu_jump_long(0x808034);
}
