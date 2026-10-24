/*
 * Routine: $8C:DBB9 (script_op_21_restart_room)
 * Source: docs/disassembly/script-vm/opcode-21-restart-room.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_fetch_u8(void);
extern void wait_for_transition_frame(void); /* $80:85D8 */
extern void script_vm_stop_all_threads(void); /* $8C:CEE9 */
extern void stop_room_entities(void); /* $8F:B38E */
extern void place_party_and_center_camera(uint16_t x_pixels,
                                          uint16_t y_pixels,
                                          uint16_t layer); /* $8F:B434 */
extern void script_vm_start_room_enter_script(void); /* $8C:CE99 */
extern uint16_t g_current_run_list_offset; /* DP $80 */
extern uint16_t g_current_thread_id; /* DP $83 */

bool script_op_21_restart_room(void) {
    wait_for_transition_frame();
    script_vm_stop_all_threads();
    stop_room_entities();

    uint16_t x_pixels = (uint16_t)script_fetch_u8() << 3;
    uint16_t y_pixels = (uint16_t)script_fetch_u8() << 3;
    place_party_and_center_camera(x_pixels, y_pixels, 0);

    script_vm_start_room_enter_script();
    g_current_thread_id = 0;
    g_current_run_list_offset = 0xFFFE;
    return false;
}