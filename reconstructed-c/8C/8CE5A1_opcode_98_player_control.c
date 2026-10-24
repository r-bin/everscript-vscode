/*
 * Routine: $8C:E5A1 (script opcode 0x98)
 * Source: docs/disassembly/script-vm/opcode-98-player-control.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t wram_read_word(uint16_t address);
extern void switch_active_character(void); /* $8C:F1A7 */

bool script_op_98_player_control(void) {
    uint16_t requested_entity = script_eval_expression();

    if (requested_entity != wram_read_word(0x0F42)) {
        switch_active_character();
    }

    return true;
}