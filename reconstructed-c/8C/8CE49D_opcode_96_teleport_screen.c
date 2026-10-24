/*
 * Routine: $8C:E49D (script opcode 0x96)
 * Source: docs/disassembly/script-vm/opcode-96-teleport-screen.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void teleport_camera_and_entities_by_screens(uint16_t dx, uint16_t dy); /* $90:A001 */

bool script_op_96_teleport_screen(void) {
    uint16_t dx = script_eval_expression();
    uint16_t dy = script_eval_expression();

    teleport_camera_and_entities_by_screens(dx, dy);
    return true;
}