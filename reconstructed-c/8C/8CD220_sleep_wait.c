/*
 * Routine: $8CD220 (sleep_wait)
 * Bank: $8C (ROM Offset: $0CD220)
 * Source: docs/disassembly/script-vm/sleep-wait.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef enum {
    SCRIPT_STATE_INACTIVE     = 0,
    SCRIPT_STATE_READY        = 2,
    SCRIPT_STATE_SLEEP        = 4,
    SCRIPT_STATE_WAIT_ENTITY  = 6,
    SCRIPT_STATE_WAIT_TRIGGER = 8,
    SCRIPT_STATE_WAIT_TEXTBOX = 10,
    SCRIPT_STATE_WAIT_CAMERA  = 12
} ScriptThreadState;

typedef struct {
    uint8_t  _pad0[3];
    uint16_t state;             // +0x03: ScriptThreadState
    uint16_t wait_param_lo;     // +0x05: wake tick lo / entity event mask / target ID
    uint16_t wait_param_hi;     // +0x07: wake tick hi / camera Y
    uint8_t  _pad1[2];
    uint16_t return_pc;         // +0x0B
    uint8_t  return_bank;       // +0x0D
    uint8_t  _pad2[48];
    uint16_t parent_slot_id;    // +0x3E
} ScriptThread;

typedef struct {
    uint8_t  _pad0[16];
    uint16_t status_flags;      // +0x10: Animation & busy flags
    uint8_t  _pad1[90];
    int16_t  script_link;       // +0x6C: Owner script thread slot (-1 if none)
    uint8_t  _pad2[26];
    uint16_t waiting_thread;    // +0x88: Waiting thread slot ID
    uint16_t wait_event_mask;   // +0x8A: Event bitmask
} EntityRecord;

// Global WRAM registers
extern uint16_t g_field_frame_counter_lo; // $7E:0B19
extern uint16_t g_field_frame_counter_hi; // $7E:0B1B
extern int16_t  g_active_step_trigger;    // $7E:2429
extern uint16_t g_active_textbox_index;   // $7E:0FAE
extern uint8_t  g_camera_target_x;        // DP $BF
extern uint8_t  g_camera_target_y;        // DP $C1
extern uint16_t g_entity_script_owner[];  // $7E:3C18
extern uint16_t g_entity_script_busy[];   // $7E:3C1A

extern uint16_t script_eval_expression(void); // $8C:EA43

/**
 * script_op_39_3b_sleep ($8C:D220)
 * Evaluates duration expression. If > 0, sets thread state to SLEEP (4)
 * with 32-bit wake timestamp and yields the current turn.
 * 
 * @param thread Pointer to active script thread record.
 * @return true if execution continues immediately; false if turn yields.
 */
bool script_op_39_3b_sleep(ScriptThread *thread) {
    uint16_t duration = script_eval_expression();
    if (duration == 0) {
        // Carry set: duration of 0 ticks continues immediately without yielding
        return true;
    }

    // 32-bit addition with frame counter
    uint32_t current_ticks = ((uint32_t)g_field_frame_counter_hi << 16) | g_field_frame_counter_lo;
    uint32_t wake_ticks = current_ticks + (duration - 1);

    thread->wait_param_lo = (uint16_t)(wake_ticks & 0xFFFF);
    thread->wait_param_hi = (uint16_t)(wake_ticks >> 16);
    thread->state = SCRIPT_STATE_SLEEP;

    // Carry clear: yield current turn to scheduler
    return false;
}

/**
 * script_op_wait ($8C:D244, Opcode 0x2E)
 * Synchronizes execution with an entity, dialogue text box, step trigger, or camera.
 * 
 * @param thread Pointer to active script thread record.
 * @return true if thread continues; false if thread yields turn.
 */
bool script_op_wait(ScriptThread *thread, uint16_t current_thread_id) {
    uint16_t target = script_eval_expression();

    // Check if target is an entity pointer (>= 0x2000 in WRAM)
    if (target >= 0x2000) {
        EntityRecord *entity = (EntityRecord *)(uintptr_t)target;

        // Check if entity has an attached script slot
        if (entity->script_link >= 0) {
            uint16_t slot = (uint16_t)entity->script_link;
            if (g_entity_script_owner[slot] == current_thread_id) {
                g_entity_script_busy[slot] = 0x0010;
                thread->wait_param_lo = 0x0010;
                thread->state = SCRIPT_STATE_WAIT_ENTITY;
                return false;
            }
        }

        // Check entity status flags
        if ((entity->status_flags & 0x0100) &&
            (entity->status_flags & 0x0040) &&
            !(entity->status_flags & 0x2001)) {
            
            if (entity->waiting_thread == 0) {
                entity->waiting_thread = current_thread_id;
                entity->wait_event_mask = 0x0020;
                thread->wait_param_lo = 0x0020;
                thread->state = SCRIPT_STATE_WAIT_ENTITY;
                return false;
            }
        }

        // Entity is idle or not ready; yield 1 tick
        return false;
    }

    // Special event targets (< 0x2000)
    if (target & 0x0100) {
        // Dialogue window / text box wait
        uint16_t window_id = target & 0x00FF;
        if (window_id < g_active_textbox_index) {
            thread->wait_param_lo = window_id;
            thread->state = SCRIPT_STATE_WAIT_TEXTBOX;
        }
        return false;
    }

    // Selector: 1 = Step-on trigger wait
    if (target == 1) {
        if (g_active_step_trigger >= 0) {
            thread->wait_param_lo = (uint16_t)g_active_step_trigger;
            thread->state = SCRIPT_STATE_WAIT_TRIGGER;
        }
        return false;
    }

    // Selector: 2 = Camera scroll wait
    if (target == 2) {
        thread->wait_param_lo = g_camera_target_x;
        thread->wait_param_hi = g_camera_target_y;
        thread->state = SCRIPT_STATE_WAIT_CAMERA;
        return false;
    }

    // Unrecognized event: default 1-tick yield
    return false;
}
