/*
 * Routine: $8C:E040 (move_entity_by_pixel_offset)
 * Bank: $8C (ROM Offset: $0CE040)
 * Source: docs/disassembly/script-vm/move-entity-by-pixel-offset.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct Entity {
    uint8_t padding0[0x10];
    uint16_t status_flags;
    uint8_t padding1[0x08];
    uint16_t x;
    uint16_t y;
} Entity;

extern Entity *script_eval_entity_expression(void); /* $8C:EC8E */
extern uint16_t script_eval_expression(void);       /* $8C:EA43 */
extern volatile uint16_t g_dp_target_x;             /* Direct page $46 */
extern volatile uint16_t g_dp_target_y;             /* Direct page $48 */
extern volatile uint16_t g_move_result;             /* $7E:23E3 */
extern bool entity_movement_probe(void);            /* $8F:AF48; result in carry */
extern void entity_position_commit(void);            /* $8F:C2E4 */

bool script_op_move_entity_by_pixel_offset(void) {
    Entity *entity = script_eval_entity_expression();
    g_dp_target_x = script_eval_expression();
    g_dp_target_y = script_eval_expression();

    if ((g_dp_target_x | g_dp_target_y) == 0) {
        g_move_result = 1;
        return true;
    }

    if ((entity->status_flags & 0x0008) != 0) {
        goto rejected;
    }

    g_dp_target_x = (uint16_t)(entity->x + g_dp_target_x);
    g_dp_target_y = (uint16_t)(entity->y + g_dp_target_y);
    entity->status_flags &= 0xF7FF;

    if (!entity_movement_probe()) {
        goto rejected;
    }

    entity_position_commit();
    g_move_result = 1;
    return true;

rejected:
    g_move_result = 0;
    return true;
}