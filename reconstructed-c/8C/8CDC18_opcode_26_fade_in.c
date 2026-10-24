/*
 * Routine: $8C:DC18 (script_op_26_fade_in)
 * Source: docs/disassembly/script-vm/opcode-26-fade-in.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t bus_read_word(uint32_t address);
extern void wram_write_word(uint16_t address, uint16_t value);
extern void engine_sync_transition_wait(void); /* $80:85D8 */
extern void engine_camera_center_and_clamp(void); /* $90:94AB */

bool script_op_26_fade_in(void) {
    uint16_t input_state = bus_read_word(0x0105);

    if ((input_state & 0x8000) == 0 && (input_state & 0x0F00) == 0) {
        engine_sync_transition_wait();
    }

    engine_camera_center_and_clamp();
    wram_write_word(0x0106, 0);
    wram_write_word(0x0B83, 0x800F);
    return true;
}