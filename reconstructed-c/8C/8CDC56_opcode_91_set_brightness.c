/*
 * Routine: $8C:DC56 (script opcode 0x91)
 * Source: docs/disassembly/script-vm/opcode-91-set-brightness.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t bus_read_word(uint32_t address);
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void wram_write_word(uint16_t address, uint16_t value);
extern void engine_sync_transition_wait(void); /* $80:85D8 */
extern void engine_camera_center_and_clamp(void); /* $90:94AB */

bool script_op_91_set_brightness(void) {
    uint16_t input_state = bus_read_word(0x0105);

    if ((input_state & 0x8000) != 0) {
        engine_camera_center_and_clamp();
        wram_write_word(0x0106, 0);
    } else if ((input_state & 0x0F00) == 0) {
        engine_sync_transition_wait();
        engine_camera_center_and_clamp();
        wram_write_word(0x0106, 0);
    }

    uint16_t brightness = script_eval_expression();
    wram_write_word(0x0106, brightness);
    return true;
}