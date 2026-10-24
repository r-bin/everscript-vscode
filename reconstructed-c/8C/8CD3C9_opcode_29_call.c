/*
 * Routine: $8C:D3C9 (script_op_29_call)
 * Source: docs/disassembly/script-vm/opcode-29-call.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_fetch_u8(void);
extern uint16_t script_fetch_u16(void);
extern void script_vm_allocate_and_chain_packed_call(uint16_t pointer_low,
                                                     uint8_t pointer_high);

bool script_op_29_call(void) {
    uint16_t pointer_low = script_fetch_u16();
    uint8_t pointer_high = script_fetch_u8();

    script_vm_allocate_and_chain_packed_call(pointer_low, pointer_high);
    return false;
}