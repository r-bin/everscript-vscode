/*
 * Routine: $8C:DD60 (script_op_3f_attach_event_script)
 * Source: docs/disassembly/script-vm/opcode-3f-attach-event-script.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void);
extern uint16_t script_fetch_u16(void);
extern void bus_write_word(uint32_t address, uint16_t value);
extern void script_start_entity_event_thread(uint16_t entity_address,
                                            uint16_t event_reason);

bool script_op_3f_attach_event_script(void) {
    uint16_t target = script_eval_expression();
    uint16_t event_mask = script_fetch_u16();
    uint16_t trigger_id = script_fetch_u16();

    if (target < 0x2000) {
        uint16_t offset = (uint16_t)((target - 1u) << 1);
        bus_write_word(0x7E0EA2u + offset, event_mask);
        bus_write_word(0x7E0EACu + offset,
                       event_mask == 0 ? 0xFFFF : trigger_id);
        return true;
    }

    bus_write_word(0x7E0000u + target + 0x68u, event_mask);
    bus_write_word(0x7E0000u + target + 0x66u, trigger_id);
    if ((event_mask & 0x0400) != 0) {
        script_start_entity_event_thread(target, 0x0400);
    }

    return true;
}