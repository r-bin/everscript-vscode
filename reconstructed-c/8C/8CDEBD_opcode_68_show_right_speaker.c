/*
 * Routine: $8C:DEBD (opcode 0x68)
 * Source: docs/disassembly/script-vm/opcode-68-show-right-speaker.md
 */

#include <stdbool.h>
#include <stdint.h>

extern volatile uint16_t wram_0b75;
extern uint16_t script_eval_expression(void);
extern void dialogue_speaker_show(uint16_t slot, uint16_t entity_id);

bool script_op_68_show_right_speaker(void) {
    uint16_t entity_id = script_eval_expression();
    wram_0b75 = entity_id;
    dialogue_speaker_show(2, entity_id);
    return true;
}