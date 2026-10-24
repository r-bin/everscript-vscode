/*
 * Routine: $8C:D3A0 (script opcode 0xA3)
 * Source: docs/disassembly/script-vm/opcode-a3-call-global.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint8_t script_read_u8(void); /* reads through DP $82 and advances it */
extern uint16_t rom_read_word(uint32_t address);
extern uint8_t rom_read_u8(uint32_t address);
extern void enqueue_global_script_call(uint16_t target_pc, uint8_t target_bank); /* $8C:CF18 */

bool script_op_a3_call_global(void) {
    uint8_t script_id = script_read_u8();
    uint16_t index_offset = (uint16_t)(script_id * 3u);
    index_offset = (uint16_t)(index_offset + rom_read_word(0x928008));
    index_offset = (uint16_t)(index_offset + rom_read_word(0x928000));

    uint32_t entry_address = 0x928000u + index_offset;
    uint16_t target_pc = rom_read_word(entry_address);
    uint8_t target_bank = rom_read_u8(entry_address + 2u);
    enqueue_global_script_call(target_pc, target_bank);
    return false;
}