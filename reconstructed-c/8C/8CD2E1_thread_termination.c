/*
 * Routine: $8CD2E1 (thread_termination)
 * Bank: $8C (ROM Offset: $0CD2E1)
 * Source: docs/disassembly/script-vm/thread-termination.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_SCRIPT_THREADS 32

typedef struct {
    uint8_t  _pad0[3];
    uint16_t state;             // +0x03: 0 = inactive/free
    uint8_t  _pad1[6];
    uint16_t return_pc;         // +0x0B: Caller return PC
    uint16_t parent_slot_ptr;   // +0x0D: Caller parent slot pointer (or 0 if root)
    uint8_t  _pad2[47];
    uint16_t child_wait_count;  // +0x3E: Child threads wait counter
} ScriptThreadSlot;

// WRAM script scheduler registers
extern uint16_t g_active_thread_run_list[]; // $7E:2F28
extern uint16_t g_current_run_list_offset;  // DP $80
extern uint16_t g_current_thread_id;        // DP $83
extern uint16_t g_total_active_threads;     // DP $86

/**
 * script_op_00_end ($8C:D2E1)
 * Terminates the current script thread or returns from a called subroutine.
 * 
 * @param current_thread Pointer to the executing thread slot.
 * @return Always returns false to yield execution to the next thread.
 */
bool script_op_00_end(ScriptThreadSlot *current_thread) {
    // 1. Mark current thread slot free / inactive
    current_thread->state = 0;

    // 2. If this was a spawned child thread, notify parent
    if (current_thread->parent_slot_ptr != 0) {
        ScriptThreadSlot *parent = (ScriptThreadSlot *)(uintptr_t)current_thread->parent_slot_ptr;
        if (parent->child_wait_count > 0) {
            parent->child_wait_count--;
        }
    }

    // Rewind run-list pointer by 1 slot
    uint16_t offset = g_current_run_list_offset - 2;
    g_current_run_list_offset = offset;

    // 3. Check if returning to caller or terminating root thread
    if (current_thread->return_pc != 0) {
        // Subroutine return: reinsert parent caller into active run-list
        offset += 2;
        g_active_thread_run_list[offset / 2] = current_thread->return_pc;
        return false;
    }

    // 4. Root thread termination: Compact active run-list array ($7E:2F28)
    do {
        offset += 2;
        uint16_t next_slot = g_active_thread_run_list[(offset + 2) / 2];
        g_active_thread_run_list[offset / 2] = next_slot;
    } while (g_active_thread_run_list[offset / 2] != 0);

    // Decrement total active threads count
    g_total_active_threads -= 2;

    // Clear active thread slot ID
    g_current_thread_id = 0;

    // Yield current turn to scheduler
    return false;
}
