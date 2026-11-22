/*
 * Routine: $8C:E0B0 (script opcode 0x78)
 * Source: docs/disassembly/script-vm/animate.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef uint16_t EntityAddress;

typedef struct {
    uint16_t one_shot; /* $7E:23D9 */
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
extern void start_entity_animation(uint16_t animation_id); /* $90:8124 */

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

    /* JMP ($E100,X): $E139, $E115, $E11D, $E130, $E10C, $E125; every target ends at $E139. */
    switch (mode) {
        case 0: /* $E139 */
            break;
        case 2: /* $E115 */
            entity_write_word(entity, 0x0012,
                              (uint16_t)(entity_read_word(entity, 0x0012) | 0x0200));
            break;
        case 4: /* $E11D */
            entity_write_word(entity, 0x0012,
                              (uint16_t)(entity_read_word(entity, 0x0012) | 0x0100));
            break;
        case 6: /* $E130 */
            entity_write_word(entity, 0x0010,
                              (uint16_t)(entity_read_word(entity, 0x0010) | 0x2000));
            break;
        case 8: /* $E10C: TDC, so 0 while DP is 0 */
            entity_write_word(entity, 0x0003, 0);
            entity_write_word(entity, 0x0001, 0);
            break;
        case 10: /* $E125 */
            entity_write_word(entity, 0x0010,
                              (uint16_t)(entity_read_word(entity, 0x0010) | 0x0001));
            break;
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