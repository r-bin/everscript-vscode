/*
 * Routine: $8C:DD4B (script_op_3d_attach_talk_script)
 * Source: docs/disassembly/script-vm/opcode-3d-attach-talk-script.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint8_t padding[0x66];
    uint16_t event_script_id;
    uint16_t event_mask;
} EntityTalkScriptFields;

extern EntityTalkScriptFields *script_eval_entity(void);
extern uint16_t script_fetch_u16(void);

bool script_op_3d_attach_talk_script(void) {
    EntityTalkScriptFields *entity = script_eval_entity();
    entity->event_script_id = script_fetch_u16();
    entity->event_mask = 0x0040;
    return true;
}