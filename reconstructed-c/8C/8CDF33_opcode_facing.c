/*
 * Routine: $8CDF33 (opcode_facing)
 * Bank: $8C (ROM Offset: $0CDF33)
 * Source: docs/disassembly/script-vm/opcode-facing.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

// Compass Facing Direction Constants
typedef enum {
    FACING_NORTH = 0,
    FACING_EAST  = 4,
    FACING_SOUTH = 8,
    FACING_WEST  = 12
} FacingDirection;

// Entity Structure Layout
typedef struct {
    uint8_t  padding0[0x1A];
    uint16_t world_x;          // +0x1A: World X coordinate (pixels)
    uint16_t world_y;          // +0x1C: World Y coordinate (pixels)
    uint8_t  padding1[0x04];
    uint16_t facing_direction; // +0x22: Compass facing direction (0, 4, 8, 12)
} Entity;

// Direct Page Register Mappings
#define DP_EVAL_ENTITY_PTR     (*(volatile Entity**)0x4C)

// External Script VM Evaluator
extern Entity* script_eval_entity_expression(void); // $8C:EC8E

/**
 * Calculates dominant 4-quadrant compass orientation from source to target.
 * ROM Address: $8C:DF33
 */
uint16_t entity_compute_facing_towards(Entity* source, Entity* target) {
    if (!source || !target) {
        return FACING_SOUTH;
    }

    int16_t dx = (int16_t)(source->world_x - target->world_x);
    int16_t dy = (int16_t)(source->world_y - target->world_y);

    uint16_t abs_dx = (uint16_t)abs(dx);
    uint16_t abs_dy = (uint16_t)abs(dy);

    FacingDirection facing;

    if (abs_dy >= abs_dx) {
        // Vertical axis dominant
        if (dy >= 0) {
            facing = FACING_NORTH; // Target is above source
        } else {
            facing = FACING_SOUTH; // Target is below source
        }
    } else {
        // Horizontal axis dominant
        if (dx >= 0) {
            facing = FACING_WEST;  // Target is left of source
        } else {
            facing = FACING_EAST;  // Target is right of source
        }
    }

    source->facing_direction = facing;
    return facing;
}

/**
 * Opcode 0x74: Set Entity Facing to North (0)
 * Bytecode: [0x74] [entity: E]
 * ROM Address: $8C:DEDF
 */
void script_op_face_north(void) {
    Entity* entity = script_eval_entity_expression();
    if (entity) {
        entity->facing_direction = FACING_NORTH;
    }
}

/**
 * Opcode 0x77: Set Entity Facing to East (4)
 * Bytecode: [0x77] [entity: E]
 * ROM Address: $8C:DEE9
 */
void script_op_face_east(void) {
    Entity* entity = script_eval_entity_expression();
    if (entity) {
        entity->facing_direction = FACING_EAST;
    }
}

/**
 * Opcode 0x75: Set Entity Facing to South (8)
 * Bytecode: [0x75] [entity: E]
 * ROM Address: $8C:DEF5
 */
void script_op_face_south(void) {
    Entity* entity = script_eval_entity_expression();
    if (entity) {
        entity->facing_direction = FACING_SOUTH;
    }
}

/**
 * Opcode 0x76: Set Entity Facing to West (12)
 * Bytecode: [0x76] [entity: E]
 * ROM Address: $8C:DF01
 */
void script_op_face_west(void) {
    Entity* entity = script_eval_entity_expression();
    if (entity) {
        entity->facing_direction = FACING_WEST;
    }
}

/**
 * Opcode 0x70: Orient Source Entity Toward Target Entity
 * Bytecode: [0x70] [target: E] [source: E]
 * ROM Address: $8C:DF0D
 */
void script_op_face_towards_entity(void) {
    Entity* target = script_eval_entity_expression();
    Entity* source = script_eval_entity_expression();

    if (source && target) {
        entity_compute_facing_towards(source, target);
    }
}

/**
 * Opcode 0x71: Orient Source Entity 180° Away from Target Entity
 * Bytecode: [0x71] [target: E] [source: E]
 * ROM Address: $8C:DF1D
 */
void script_op_face_away_from_entity(void) {
    Entity* target = script_eval_entity_expression();
    Entity* source = script_eval_entity_expression();

    if (source && target) {
        uint16_t facing = entity_compute_facing_towards(source, target);
        // Invert orientation by 180 degrees (EOR #0x0008)
        source->facing_direction = facing ^ 0x0008;
    }
}
