/*
 * Routine: $8C:E88A (script opcode 0xB7)
 * Palette slot mapping/loading: $8C:E899
 * Source: docs/disassembly/script-vm/opcode-b7-palette-cycle-stop.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void load_palette_cycle_source(uint16_t palette); /* $8C:E899 */
extern void wram_write_word(uint16_t address, uint16_t value);

void script_op_b7_palette_cycle_stop(void) {
    uint16_t palette = script_eval_expression();
    load_palette_cycle_source(palette);

    uint16_t cycle_speed_address = (uint16_t)(0x13D2 + palette);
    wram_write_word(cycle_speed_address, 0);
}
