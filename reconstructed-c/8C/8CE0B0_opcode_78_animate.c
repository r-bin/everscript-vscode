/*
 * Routine: $8C:E0B0 (script opcode 0x78)
 * Source: docs/disassembly/script-vm/animate.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef uint16_t EntityAddress;

typedef struct {
    uint16_t one_shot; /* $7E:23D9 */
    uint16_t dp_0106;
    uint16_t dp_0b83;
    uint16_t dp_22;
    uint16_t dp_24;
    uint16_t dp_26;
    uint16_t dp_28;
    uint16_t dp_0f3e;
} ScriptVmState;

typedef enum {
    SCRIPT_HANDLER_CONTINUES,
    SCRIPT_HANDLER_UNMODELED_DISPATCH
} ScriptHandlerResult;

extern EntityAddress script_eval_entity_expression(void); /* $8C:EC8E, result at DP $4C */
extern uint16_t script_eval_expression(void);             /* $8C:EA43 */
extern uint16_t script_fetch_u16(void);                   /* [$82], then INC $82 twice */
extern uint16_t entity_read_word(EntityAddress entity, uint16_t offset);
extern void entity_write_word(EntityAddress entity, uint16_t offset, uint16_t value);
extern uint16_t rom_read_word_long(uint32_t address);
extern void rom_call_8ee56a(void);
extern void rom_call_808fee(void);
extern void rom_call_80858c(void);
extern void rom_call_8caf23(void);
extern void rom_call_8cb743(void);
extern void rom_call_8d8000(void);
extern void rom_call_80b149(void);
extern void rom_call_8d82cb(void);
extern void rom_call_8ee08b(void);
extern void rom_call_9092c7(void);
extern void rom_call_8cab10(void);
extern void rom_call_8f87fe(uint16_t x_value);
extern void start_entity_animation(uint16_t animation_id); /* $90:8124 */

static void run_mode_10_path(ScriptVmState *state) {
    rom_call_8ee56a();
    rom_call_808fee();
    rom_call_80858c();
    rom_call_8caf23();
    rom_call_8cb743();
    rom_call_8d8000();

    state->dp_0106 = 0;
    state->dp_0b83 = 0x800F;

    uint16_t selector = script_fetch_u16();
    state->dp_24 = (uint16_t)(rom_read_word_long(0x8CE1FFUL + selector) & 0x00FF);
    state->dp_22 = rom_read_word_long(0x8CE1FDUL + selector);
    if (state->dp_22 == 0x2234) {
        state->dp_26 = 0x60AC;
        state->dp_28 = 0x00C4;
        rom_call_80b149();
    }

    rom_call_8d82cb();
    rom_call_8ee56a();
    rom_call_808fee();
    rom_call_8caf23();
    rom_call_8ee08b();
    rom_call_9092c7();
    rom_call_80858c();
    rom_call_8cab10();
    rom_call_8f87fe(state->dp_0f3e);

    state->dp_0106 = 0;
    state->dp_0b83 = 0x800F;
}

ScriptHandlerResult script_op_78_animate(ScriptVmState *state) {
    EntityAddress entity = script_eval_entity_expression();
    uint16_t animation_word = script_fetch_u16();
    uint16_t mode = script_eval_expression();

    if (entity < 0x4E89 && entity_read_word(entity, 0x002A) == 0) {
        uint16_t entity_flags = entity_read_word(entity, 0x0010);
        if ((entity_flags & 0x0008) != 0 || state->one_shot == 0) {
            state->one_shot = 0;
            return SCRIPT_HANDLER_CONTINUES;
        }
    }

    state->one_shot = 0;
    entity_write_word(entity, 0x002E, 0x0400);

    uint16_t entity_flags = entity_read_word(entity, 0x0010);
    entity_write_word(entity, 0x0010,
                      (uint16_t)((entity_flags | 0x0040) & 0xDFFE));
    uint16_t entity_state = entity_read_word(entity, 0x0012);
    entity_write_word(entity, 0x0012, (uint16_t)(entity_state & 0xFCFF));

    switch (mode) {
        case 0:
            break;
        case 2:
            entity_write_word(entity, 0x0012,
                              (uint16_t)(entity_read_word(entity, 0x0012) | 0x0200));
            break;
        case 4:
            entity_write_word(entity, 0x0012,
                              (uint16_t)(entity_read_word(entity, 0x0012) | 0x0100));
            break;
        case 6:
            entity_write_word(entity, 0x0003, 0);
            entity_write_word(entity, 0x0001, 0);
            break;
        case 8:
            entity_write_word(entity, 0x0010,
                              (uint16_t)(entity_read_word(entity, 0x0010) | 0x0001));
            break;
        case 10:
            run_mode_10_path(state);
            return SCRIPT_HANDLER_CONTINUES;
        default:
            return SCRIPT_HANDLER_UNMODELED_DISPATCH;
    }

    uint16_t animation_id;
    if ((animation_word & 0x8000) == 0) {
        animation_id = rom_read_word_long(0xC43C92UL + animation_word);
    } else {
        uint16_t list_offset = entity_read_word(entity, 0x0060);
        uint16_t index = (uint16_t)(list_offset + (animation_word & 0x7FFF));
        animation_id = rom_read_word_long(0x8E0032UL + index);
    }

    start_entity_animation(animation_id);
    return SCRIPT_HANDLER_CONTINUES;
}