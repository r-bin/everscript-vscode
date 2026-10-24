/*
 * Routine: $8C:E156 (script opcode 0x79)
 * Source: docs/disassembly/script-vm/animate-and-wait.md
 */

#include <stdbool.h>
#include <stdint.h>

extern void call_script_opcode_78(void); /* $8C:E0B0 */
extern uint16_t script_vm_read_dp_word(uint16_t offset);
extern uint16_t script_vm_read_wram_word(uint16_t address);
extern void script_vm_write_wram_word(uint16_t address, uint16_t value);

bool script_op_79_animate_and_wait(void) {
    call_script_opcode_78();

    uint16_t entity = script_vm_read_dp_word(0x004C);
    if (script_vm_read_wram_word((uint16_t)(entity + 0x0088)) != 0) {
        return false;
    }

    uint16_t thread_slot = script_vm_read_dp_word(0x007E);
    script_vm_write_wram_word((uint16_t)(entity + 0x0088), thread_slot);
    script_vm_write_wram_word((uint16_t)(thread_slot + 0x0003), 0x0006);

    script_vm_write_wram_word((uint16_t)(entity + 0x008A), 0x0020);
    script_vm_write_wram_word((uint16_t)(thread_slot + 0x0005), 0x0020);
    script_vm_write_wram_word((uint16_t)(thread_slot + 0x0009), 0x0000);

    return false;
}