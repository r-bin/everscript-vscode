/*
 * Routine: $8C:E6CF (script opcode 0x9A)
 * Source: docs/disassembly/script-vm/opcode-9a-font.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t rom_read_word(uint32_t bus_address);
extern void font_loader_enter_data_bank_80(void); /* PHB; PEA $8080; PLB; PLB */
extern void load_font_header(uint16_t header_offset); /* $8C:9DAF */
extern void font_loader_restore_data_bank(void); /* PLB */

bool script_op_9a_font(void) {
    uint16_t table_offset = script_eval_expression();
    uint16_t header_offset = rom_read_word(0x8CE6E6UL + table_offset);

    font_loader_enter_data_bank_80();
    load_font_header(header_offset);
    font_loader_restore_data_bank();
    return true;
}