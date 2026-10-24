/*
 * Routine: $8CD331 (callback_dispatch)
 * Bank: $8C (ROM Offset: $0CD331)
 * Source: docs/disassembly/script-vm/callback-dispatch.md
 */

#include <stdint.h>
#include <stdbool.h>

#define SCRIPT_BANK_92 0x92

typedef struct ScriptThread {
    uint8_t  slot_id;           // Thread slot index (0..31)
    uint16_t pc;                // +0x08: Program Counter
    uint8_t  bank;              // +0x0A: ROM Bank
    uint16_t return_pc;         // +0x0B: Caller return PC
    uint8_t  return_bank;       // +0x0D: Caller return Bank
    uint8_t  parent_slot;       // +0x3E: Parent thread link
    bool     is_active;
} ScriptThread;

extern ScriptThread g_script_threads[32]; // $7E:2F28 run-list slots
extern const uint16_t g_trigger_table_origin; // word[$92:8000]
extern const uint16_t g_trigger_pointers[];   // $92:8000 + origin
extern const uint16_t g_global_pointers[];    // $92:8008

extern void script_vm_eval_args(ScriptThread *thread);       // $8C:D315
extern ScriptThread *script_vm_allocate_slot(void);          // $8C:CF18
extern void script_vm_link_async_thread(ScriptThread *caller, ScriptThread *child);
extern void script_vm_add_to_run_list(ScriptThread *thread);  // $8C:CE86

/**
 * Spawns a child thread to execute a subroutine, suspending the caller.
 * Corresponds to $8C:D35C.
 */
static void script_chain_call(ScriptThread *caller, uint8_t target_bank, uint16_t target_pc) {
    ScriptThread *child = script_vm_allocate_slot();
    if (!child) {
        return; // Allocation failure
    }

    // Save caller return context
    caller->return_pc = caller->pc;
    caller->return_bank = caller->bank;

    // Link parent-child hierarchy
    child->parent_slot = caller->slot_id;
    child->bank = target_bank;
    child->pc = target_pc;
    child->is_active = true;

    // Suspend caller until child finishes
    caller->is_active = false;
}

/**
 * Opcode 0xB3: Call far subroutine with arguments across ROM banks.
 * Corresponds to $8C:D331.
 */
void script_op_b3_call_back_far_with_args(ScriptThread *thread, const uint8_t *rom_stream) {
    script_vm_eval_args(thread);

    uint16_t target_pc = *(const uint16_t *)(rom_stream + thread->pc);
    thread->pc += 2;
    uint8_t target_bank = rom_stream[thread->pc++];

    script_chain_call(thread, target_bank, target_pc);
}

/**
 * Opcode 0xB2: Call local subroutine with arguments within the same script bank.
 * Corresponds to $8C:D34C.
 */
void script_op_b2_call_back_with_args(ScriptThread *thread, const uint8_t *rom_stream) {
    script_vm_eval_args(thread);

    uint16_t target_pc = *(const uint16_t *)(rom_stream + thread->pc);
    thread->pc += 2;

    script_chain_call(thread, thread->bank, target_pc);
}

/**
 * Opcode 0xA5: Call a script up to 256 bytes before this instruction.
 * Corresponds to $8C:D35C.
 */
void script_op_a5_call_back(ScriptThread *caller, const uint8_t *rom_stream) {
    uint16_t opcode_pc = (uint16_t)(caller->pc - 1);
    uint8_t encoded_distance = rom_stream[caller->pc++];
    uint16_t backward_distance = (uint16_t)(0x0100 - encoded_distance);
    uint32_t packed_opcode = ((uint32_t)caller->bank << 16) | opcode_pc;
    uint32_t packed_target = (packed_opcode - backward_distance) & 0x00FFFFFFu;

    script_chain_call(caller, (uint8_t)(packed_target >> 16), (uint16_t)packed_target);
}

/**
 * Opcode 0xA6: Call a script before this instruction using a 16-bit offset.
 * Corresponds to $8C:D340.
 */
void script_op_a6_call_back_far(ScriptThread *caller, const uint8_t *rom_stream) {
    uint16_t opcode_pc = (uint16_t)(caller->pc - 1);
    uint16_t encoded_offset = (uint16_t)(rom_stream[caller->pc]
        | ((uint16_t)rom_stream[(uint16_t)(caller->pc + 1)] << 8));
    caller->pc = (uint16_t)(caller->pc + 2);

    uint32_t packed_opcode = ((uint32_t)caller->bank << 16) | opcode_pc;
    uint32_t packed_target = (packed_opcode + encoded_offset - 0x00010000u) & 0x00FFFFFFu;
    script_chain_call(caller, (uint8_t)(packed_target >> 16), (uint16_t)packed_target);
}

/**
 * Opcode 0xA4 & 0xB1: Call room trigger script.
 * Corresponds to $8C:D392 and $8C:D395.
 */
void script_op_call_trigger(ScriptThread *thread, const uint8_t *rom_stream, bool with_args) {
    if (with_args) {
        script_vm_eval_args(thread);
    }

    uint16_t trigger_idx = *(const uint16_t *)(rom_stream + thread->pc);
    thread->pc += 2;

    uint16_t target_pc = g_trigger_pointers[trigger_idx];
    script_chain_call(thread, SCRIPT_BANK_92, target_pc);
}

/**
 * Opcode 0xB0: Call global script with arguments.
 * Corresponds to $8C:D39D.
 */
void script_op_b0_call_global_with_args(ScriptThread *thread, const uint8_t *rom_stream) {
    script_vm_eval_args(thread);

    uint8_t global_idx = rom_stream[thread->pc++];
    uint16_t target_pc = g_global_pointers[global_idx];

    script_chain_call(thread, SCRIPT_BANK_92, target_pc);
}

/**
 * Opcode 0xAF: evaluate counted arguments, then call a far script target.
 * Corresponds to $8C:D3C6.
 */
void script_op_af_call_with_args(ScriptThread *caller, const uint8_t *rom_stream) {
    script_vm_eval_args(caller);

    uint16_t target_pc = (uint16_t)(rom_stream[caller->pc]
        | ((uint16_t)rom_stream[(uint16_t)(caller->pc + 1)] << 8));
    caller->pc = (uint16_t)(caller->pc + 2);
    uint8_t target_bank = rom_stream[caller->pc++];

    script_chain_call(caller, target_bank, target_pc);
}

/**
 * Opcode 0xB4: evaluate arguments and start an independent far script thread.
 * Corresponds to $8C:D3FD.
 */
void script_op_b4_start_thread_with_args(ScriptThread *caller, const uint8_t *rom_stream) {
    script_vm_eval_args(caller);

    uint16_t target_pc = (uint16_t)(rom_stream[caller->pc]
        | ((uint16_t)rom_stream[(uint16_t)(caller->pc + 1)] << 8));
    caller->pc = (uint16_t)(caller->pc + 2);
    uint8_t target_bank = rom_stream[caller->pc++];

    ScriptThread *child = script_vm_allocate_slot();
    if (!child) {
        return;
    }

    child->pc = target_pc;
    child->bank = target_bank;
    child->is_active = true;
    script_vm_link_async_thread(caller, child);
    script_vm_add_to_run_list(child);
}
