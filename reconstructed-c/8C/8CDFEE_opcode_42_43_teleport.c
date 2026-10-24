/*
 * Routines: $8C:DFEE (opcode 0x42), $8C:E00D (opcode 0x43)
 * Source: docs/disassembly/script-vm/opcode-42-43-teleport.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint8_t padding[0x10];
    uint16_t movement_flags;
} EntityMovementFields;

extern EntityMovementFields *script_eval_entity(void);
extern uint16_t script_eval_expression(void);
extern uint16_t script_fetch_u16(void);
extern int16_t g_one_shot_layer_override; /* $7E:23DB */
extern void entity_teleport_and_update_collision(EntityMovementFields *entity,
                                                 uint16_t x, uint16_t y);
extern void entity_set_position_with_layer(EntityMovementFields *entity,
                                           uint16_t x, uint16_t y,
                                           uint16_t layer);

static void teleport_entity(EntityMovementFields *entity,
                            uint16_t x, uint16_t y) {
    if ((entity->movement_flags & 0x0008) != 0) {
        return;
    }

    if (g_one_shot_layer_override >= 0) {
        uint16_t layer = (uint16_t)g_one_shot_layer_override;
        g_one_shot_layer_override = -1;
        entity_set_position_with_layer(entity, x, y, layer);
        return;
    }

    entity_teleport_and_update_collision(entity, x, y);
}

bool script_op_42_teleport_tile(void) {
    EntityMovementFields *entity = script_eval_entity();
    uint16_t packed_tile = script_fetch_u16();
    uint16_t x = (uint16_t)((packed_tile & 0x00FF) << 3);
    uint16_t y = (uint16_t)(((packed_tile >> 8) & 0x00FF) << 3);

    teleport_entity(entity, x, y);
    return true;
}

bool script_op_43_teleport(void) {
    EntityMovementFields *entity = script_eval_entity();
    uint16_t x = script_eval_expression();
    uint16_t y = script_eval_expression();

    teleport_entity(entity, x, y);
    return true;
}