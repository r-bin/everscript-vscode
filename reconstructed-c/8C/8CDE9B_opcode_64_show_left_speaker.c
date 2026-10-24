/*
 * Routine: $8C:DE9B (opcode 0x64)
 * Source: docs/disassembly/script-vm/opcode-64-show-left-speaker.md
 */

#include <stdbool.h>
#include <stdint.h>

extern volatile uint16_t wram_0b73;
extern uint16_t script_eval_expression(void);
extern void dialogue_speaker_show(uint16_t slot, uint16_t entity_id);

bool script_op_64_show_left_speaker(void) {
    uint16_t entity_id = script_eval_expression();
    wram_0b73 = entity_id;
    dialogue_speaker_show(1, entity_id);
    return true;
}