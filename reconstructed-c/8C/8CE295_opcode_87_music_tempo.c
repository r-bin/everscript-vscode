/*
 * Routine: $8C:E295 (script opcode 0x87)
 * Source: docs/disassembly/script-vm/opcode-87-music-tempo.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void enter_data_bank_80_preserving_current_bank(void);
extern void restore_preserved_data_bank(void);
extern void apu_command_handshake(uint16_t command, uint16_t value); /* $8C:81FD */

bool script_op_87_music_tempo(void) {
    uint16_t tempo = script_eval_expression();

    enter_data_bank_80_preserving_current_bank();
    apu_command_handshake(0x002A, tempo);
    restore_preserved_data_bank();

    return true;
}