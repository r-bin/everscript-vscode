/*
 * Routine: $8C:E66F (script opcode 0x99)
 * Source: docs/disassembly/script-vm/opcode-99-mode7-scene.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void wram_write_byte(uint16_t address, uint8_t value);
extern void wram_write_word(uint16_t address, uint16_t value);
extern void mode7_enter_data_bank_80(void); /* PHB; PEA $8080; PLB; PLB */
extern void mode7_run_scene_engine(void); /* $80:BC00 */
extern void mode7_wait_transition(void); /* $80:85D8 */
extern void mode7_initialize_field_state(void); /* $8E:E08B */
extern void mode7_wait_for_nmi_frame(void); /* $80:858C */
extern void mode7_prepare_scene(void); /* $8C:AB10 */
extern void mode7_finish_scene(void); /* $8F:87FE */
extern void mode7_restore_field(void); /* $80:8E9A */
extern void mode7_restore_data_bank(void); /* PLB */

bool script_op_99_mode7_scene(void) {
    uint16_t scene = script_eval_expression();
    wram_write_word(0x0E70, scene);

    uint16_t operand = script_eval_expression();
    wram_write_byte(0x0E74, (uint8_t)operand);
    operand = script_eval_expression();
    wram_write_byte(0x0E75, (uint8_t)operand);
    operand = script_eval_expression();
    wram_write_byte(0x0E76, (uint8_t)operand);
    operand = script_eval_expression();
    wram_write_byte(0x0E77, (uint8_t)operand);

    operand = script_eval_expression();
    wram_write_word(0x0E78, (uint16_t)((operand << 8) | (operand >> 8)));

    mode7_enter_data_bank_80();
    mode7_run_scene_engine();
    mode7_wait_transition();
    mode7_initialize_field_state();
    mode7_wait_for_nmi_frame();
    mode7_prepare_scene();
    mode7_finish_scene();
    mode7_restore_field();
    mode7_restore_data_bank();
    return true;
}