/*
 * Routine: $8CEC8E (entity_position)
 * Bank: $8C (ROM Offset: $0CEC8E)
 * Source: docs/disassembly/entities/entity-position.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint8_t  padding0[0x10];
    uint16_t status_flags;        // +0x10: Status condition bits (bit 3: locked)
    uint8_t  padding1[0x06];
    uint16_t z;                   // +0x18: Z elevation
    uint16_t x;                   // +0x1A: X coordinate (pixels)
    uint16_t y;                   // +0x1C: Y coordinate (pixels)
    uint8_t  padding2[0x1C];
    uint16_t tile_offset;         // +0x3A: Byte offset in tilemap buffer $7F:0000
    uint16_t surface_flags;       // +0x3C: Terrain surface attributes
    uint8_t  padding3[0x24];
    uint16_t tile_coord_packed;   // +0x62: Packed tile coordinates (Y: high, X: low)
    uint8_t  padding4[0x06];
    int16_t  shadow_entity_id;    // +0x6A: Attached shadow entity slot
    int16_t  held_entity_id;      // +0x6C: Attached weapon / item entity slot
    uint8_t  padding5[0x2A];
    int16_t  aux_entity_id;       // +0x98: Player barrier / aura entity slot
} Entity;

#define DP_ENTITY_PTR         (*(volatile Entity**)0x4C)
#define WRAM_MAP_WIDTH_TILES  (*(volatile uint16_t*)0x7E08EE)
#define WRAM_MAP_HEIGHT_TILES (*(volatile uint16_t*)0x7E08EF)
#define WRAM_SCRIPT_OVERRIDE_Z (*(volatile int16_t*)0x7E23DB)
#define ENTITY_BOY_BASE       ((Entity*)0x4E89)

#define TILE_MAP_BUFFER       ((const uint16_t*)0x7F0000)
#define TILE_ATTR_TABLE       ((const uint16_t*)0x7F0004)

// External Subroutines
extern void*    script_eval_entity(void);                    // $8C:EC8E
extern uint16_t script_eval_expression(void);                // $8C:EA43
extern void     coord_project_boundary(uint16_t *x, uint16_t *y); // $90:9815
extern void     coord_adjust_elevation(uint16_t *z);         // $8F:A914
extern void     entity_child_reposition(int16_t child_id);   // $8F:A7D3

/**
 * $8F:C2E4 - Sets entity world position and updates tile collision metadata.
 */
void entity_set_position_with_z(Entity *entity, uint16_t x, uint16_t y, uint16_t z) {
    if (!entity) return;

    entity->z = z;
    entity->x = x;

    uint16_t tile_x = (x >> 4) & 0x00FF;
    uint16_t map_w = WRAM_MAP_WIDTH_TILES;
    uint16_t map_h = WRAM_MAP_HEIGHT_TILES;

    entity->y = y;
    uint16_t tile_y_shifted = (y << 4) & 0xFF00; // Represents (y >> 4) << 8

    // Check if coordinates fall outside map boundaries
    if (tile_x >= map_w || tile_y_shifted >= (map_h << 8)) {
        entity->tile_coord_packed = tile_y_shifted | tile_x;
        // Out of bounds: skip reading tile attributes
    } else {
        entity->tile_coord_packed = tile_y_shifted | tile_x;

        // Linear tile calculation: (tile_y * map_width + tile_x) * 2
        // Calculated via SNES hardware multiplier registers $004202 / $004216
        uint16_t tile_y = tile_y_shifted >> 8;
        uint16_t linear_tile_index = (tile_y * map_w) + tile_x;
        uint16_t tile_byte_offset = linear_tile_index * 2;

        entity->tile_offset = tile_byte_offset;

        // Lookup tile collision descriptor and terrain flags
        uint16_t collision_word = *(const uint16_t*)((uint8_t*)0x7F0000 + tile_byte_offset);
        uint16_t surface_props = *(const uint16_t*)((uint8_t*)0x7F0004 + collision_word);
        entity->surface_flags = surface_props;
    }

    // Synchronize attached child entity positions
    if (entity->shadow_entity_id >= 0) {
        entity_child_reposition(entity->shadow_entity_id);
    }
    if (entity->held_entity_id >= 0) {
        entity_child_reposition(entity->held_entity_id);
    }

    // If player or companion, synchronize auxiliary attachments (barrier, shield, aura)
    if (entity >= ENTITY_BOY_BASE && entity->aux_entity_id >= 0) {
        entity_child_reposition(entity->aux_entity_id);
    }
}

/**
 * $8F:C2D1 - Teleport entity to (x, y) preserving its current Z elevation.
 */
void entity_set_position(Entity *entity, uint16_t x, uint16_t y) {
    if (!entity) return;

    uint16_t z = entity->z;
    
    // Clamp coordinates to room boundaries and project elevation
    coord_project_boundary(&x, &y);
    coord_adjust_elevation(&z);

    entity_set_position_with_z(entity, x, y, z);
}

/**
 * $8C:E00D - Script VM Opcode 0x43: teleport(entity, x, y)
 * Reads entity, target X, and target Y expressions from bytecode and teleports the entity.
 */
bool script_op_teleport_entity(void) {
    Entity *entity = (Entity*)script_eval_entity();
    DP_ENTITY_PTR = entity;

    uint16_t target_x = script_eval_expression();
    uint16_t target_y = script_eval_expression();

    // If entity has locked bit 3 (0x0008) in status flags, abort teleport
    if (entity->status_flags & 0x0008) {
        return true;
    }

    // Check if script specified an explicit Z elevation override in $7E:23DB
    int16_t z_override = WRAM_SCRIPT_OVERRIDE_Z;
    if (z_override >= 0) {
        WRAM_SCRIPT_OVERRIDE_Z = -1; // Reset override
        entity_set_position_with_z(entity, target_x, target_y, (uint16_t)z_override);
    } else {
        entity_set_position(entity, target_x, target_y);
    }

    // SEC: Continue execution in the current turn
    return true;
}
