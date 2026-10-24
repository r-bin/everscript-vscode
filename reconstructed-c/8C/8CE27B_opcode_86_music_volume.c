/*
 * Routine: $8C:E27B (script opcode 0x86)
 * Source: docs/disassembly/script-vm/opcode-86-music-volume.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void dp_write_word(uint16_t address, uint16_t value);
extern void enter_data_bank_80_preserving_current_bank(void);
extern void restore_preserved_data_bank(void);
extern void apu_command_handshake(uint16_t command, uint16_t value); /* $8C:81FD */

bool script_op_86_music_volume(void) {
    uint16_t volume = (uint16_t)(script_eval_expression() & 0x00FF);
    dp_write_word(0x009A, volume);

    enter_data_bank_80_preserving_current_bank();
    apu_command_handshake(0x0028, volume);
    restore_preserved_data_bank();

    return true;
}