/*
 * Routine: $8C:DBF0 (script_op_20_teleport_party)
 * Source: docs/disassembly/script-vm/opcode-20-teleport-party.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_fetch_u8(void);
extern void place_party_and_center_camera(uint16_t x_pixels,
                                          uint16_t y_pixels,
                                          uint16_t layer); /* $8F:B434 */

bool script_op_20_teleport_party(void) {
    uint16_t x_pixels = (uint16_t)script_fetch_u8() << 3;
    uint16_t y_pixels = (uint16_t)script_fetch_u8() << 3;

    place_party_and_center_camera(x_pixels, y_pixels, 0);
    return true;
}