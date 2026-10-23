/*
 * Routine: $8CCFFD (dispatcher)
 * Bank: $8C (ROM Offset: $0CCFFD)
 * Source: docs/disassembly/script-vm/dispatcher.md
 */

#include <stdint.h>
#include <stdbool.h>

// Thread Lifecycle States
typedef enum {
    SCRIPT_STATE_UNUSED  = 0,
    SCRIPT_STATE_RUNNING = 2,
    SCRIPT_STATE_SLEEP   = 4,
    SCRIPT_STATE_BUSY    = 6,
    SCRIPT_STATE_DIALOG  = 8,
    SCRIPT_STATE_WALK    = 10,
    SCRIPT_STATE_CAMERA  = 12
} ScriptThreadState;

typedef struct {
    uint16_t pc_low;          // +0x00: Script pointer low word
    uint8_t  pc_high;         // +0x01: Script pointer high byte
    uint8_t  bank;            // +0x02: Script ROM bank ($92+)
    uint16_t state;           // +0x03: ScriptThreadState
    uint16_t wait_param1;     // +0x05: Deadline low / mask / entity slot / prev cam X
    uint16_t wait_param2;     // +0x07: Deadline high / prev cam Y
    uint16_t wait_mask;       // +0x09: Entity busy mask bits
    uint16_t unused_0b;       // +0x0B
    uint16_t entity_slot;     // +0x0D: Associated actor entity pointer
    uint16_t locals[8];       // +0x0F: Thread local scratch storage
} ScriptThreadSlot;

// Global VM Context
typedef struct {
    uint16_t reentrancy_guard;           // $7E:1436
    uint32_t frame_counter;              // $7E:0B19
    uint16_t dialog_box_state;           // $7E:2429
    uint8_t  camera_x;                   // DP $BF
    uint8_t  camera_y;                   // DP $C1
    uint16_t run_list[32];               // $7E:2F28
    ScriptThreadSlot slots[16];          // $7E:28FC
} ScriptVmContext;

extern ScriptVmContext g_script_vm;
extern const uint8_t g_rom[0x400000];

// Opcode Handler Function Signature:
// Returns true to CONTINUE in the same turn (Carry Set).
// Returns false to YIELD turn until next tick or wait condition (Carry Clear).
typedef bool (*ScriptOpcodeHandler)(ScriptThreadSlot *thread, uint32_t *pc);
extern const ScriptOpcodeHandler g_script_opcode_table[256];

/**
 * Executes one thread's turn until an opcode yields or terminates.
 */
static void script_vm_execute_thread(ScriptThreadSlot *thread) {
    // Reconstruct 24-bit pointer
    uint32_t pc = ((uint32_t)thread->bank << 16) | ((uint32_t)thread->pc_high << 8) | (thread->pc_low & 0xFF);
    // Note: In 65816 assembly, pc_low is word at +0, pc_high/bank is word at +1

    bool continue_turn = true;
    while (continue_turn) {
        // Fetch opcode byte
        uint8_t opcode = g_rom[pc++];
        
        // Dispatch via opcode jump table ($8C:E8BD)
        ScriptOpcodeHandler handler = g_script_opcode_table[opcode];
        if (handler != NULL) {
            continue_turn = handler(thread, &pc);
        } else {
            // Unknown or STP opcode terminates thread
            thread->bank = 0;
            break;
        }
    }

    // Write back PC on yield, unless terminated
    if (thread->bank != 0) {
        thread->pc_low = (uint16_t)(pc & 0xFFFF);
        thread->pc_high = (uint8_t)((pc >> 16) & 0xFF); // Bank and high word layout
    }
}

/**
 * State handlers corresponding to mode table $8C:D029.
 */
static bool script_thread_check_wake(ScriptThreadSlot *thread) {
    switch (thread->state) {
        case SCRIPT_STATE_RUNNING:
            return true;

        case SCRIPT_STATE_SLEEP: {
            uint32_t deadline = ((uint32_t)thread->wait_param2 << 16) | thread->wait_param1;
            if (g_script_vm.frame_counter >= deadline) {
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            return false;
        }

        case SCRIPT_STATE_BUSY: {
            if ((thread->wait_param1 & thread->wait_mask) != 0) {
                thread->wait_mask ^= thread->wait_param1;
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            return false;
        }

        case SCRIPT_STATE_DIALOG: {
            if (g_script_vm.dialog_box_state != thread->wait_param1) {
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            return false;
        }

        case SCRIPT_STATE_WALK: {
            uint16_t entity_offset = thread->wait_param1;
            uint8_t *entity_wram = (uint8_t *)&g_script_vm + entity_offset;
            uint8_t current_step = entity_wram[0x7E];
            uint8_t target_step  = entity_wram[0xCE];
            if (current_step == target_step) {
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            return false;
        }

        case SCRIPT_STATE_CAMERA: {
            uint8_t prev_x = (uint8_t)thread->wait_param1;
            uint8_t prev_y = (uint8_t)(thread->wait_param1 >> 8);
            if (g_script_vm.camera_x == prev_x && g_script_vm.camera_y == prev_y) {
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            thread->wait_param1 = (uint16_t)g_script_vm.camera_x | ((uint16_t)g_script_vm.camera_y << 8);
            return false;
        }

        default:
            return false;
    }
}

/**
 * Top-Level Script Scheduler Pass ($8C:CFFD).
 * Iterates through active threads once per field frame.
 */
void script_scheduler_pass(void) {
    if (g_script_vm.reentrancy_guard != 0) {
        return;
    }
    g_script_vm.reentrancy_guard = 1;

    for (int i = 0; i < 32; i++) {
        uint16_t slot_offset = g_script_vm.run_list[i];
        if (slot_offset == 0) {
            break; // End of active run-list
        }

        ScriptThreadSlot *thread = (ScriptThreadSlot *)((uint8_t *)&g_script_vm + slot_offset);
        if (script_thread_check_wake(thread)) {
            script_vm_execute_thread(thread);
        }
    }

    g_script_vm.reentrancy_guard = 0;
}
