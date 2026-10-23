/*
 * Routine: $909DE8 (tile_collision)
 * Bank: $90 (ROM Offset: $109DE8)
 * Source: docs/disassembly/maps/tile-collision.md
 */

#include <stdint.h>
#include <stdbool.h>

#define COLLISION_GEOMETRY_MASK  0x000F
#define COLLISION_PLANE_MASK     0x0030
#define COLLISION_FLAG_PT        0x0040 // Bit 6: Plane-Transparent
#define COLLISION_ENTITY_GATE    0x0F00 // Bits 11..8: Entity Gate Nibble
#define COLLISION_GATE_ACTIVE    0x0100 // Bit 8: Gate Active Flag
#define COLLISION_FLAG_AW        0x2000 // Bit 13: Always-Walkable
#define COLLISION_FLAG_STEPON    0x4000 // Bit 14: Step-on Trigger
#define COLLISION_FLAG_INTERACT  0x8000 // Bit 15: B-Trigger Interactive Gate

#define ACTOR_BOY_SLOT           0x4E89
#define ACTOR_DOG_SLOT           0x4F37

#define GEOMETRY_OPEN            0x00
#define GEOMETRY_SOLID           0x0F

/**
 * Evaluates whether an entity can traverse a metatile and returns its geometry.
 * Corresponds to $90:9DE8.
 */
uint8_t eval_tile_collision(uint16_t collision_word, uint8_t entity_plane, uint16_t entity_ptr) {
    // 1. Entity Gate Check (Bits 11..8)
    if ((collision_word & COLLISION_GATE_ACTIVE) != 0) {
        uint8_t gate = (uint8_t)((collision_word >> 8) & 0x0F);
        bool is_boy_or_dog = (entity_ptr == ACTOR_BOY_SLOT || entity_ptr == ACTOR_DOG_SLOT);

        if (gate == 3) {
            // Gate 3: Solid for everything EXCEPT Boy and Dog
            if (!is_boy_or_dog) return GEOMETRY_SOLID;
        } else if (gate == 5) {
            // Gate 5: Solid specifically for the Dog
            if (entity_ptr == ACTOR_DOG_SLOT) return GEOMETRY_SOLID;
        } else if (gate == 7) {
            // Gate 7: Solid for Boy and Dog (Enemies & NPCs pass)
            if (is_boy_or_dog) return GEOMETRY_SOLID;
        }
        // Gates 1 and 9 pass through to plane logic
    }

    uint8_t tile_plane = (uint8_t)(collision_word & COLLISION_PLANE_MASK);
    bool is_transparent = (collision_word & COLLISION_FLAG_PT) != 0;

    // 2. Plane-Transparent Check (Bit 6)
    if (is_transparent) {
        if (tile_plane == entity_plane) {
            return (uint8_t)(collision_word & COLLISION_GEOMETRY_MASK);
        } else {
            return GEOMETRY_OPEN; // Walk straight through from other planes!
        }
    }

    // 3. Elevation Plane Match
    if (tile_plane != entity_plane) {
        // Plane mismatch: solid unless overridden
        return GEOMETRY_SOLID;
    }

    // 4. Always-Walkable Override (Bit 13)
    if ((collision_word & COLLISION_FLAG_AW) != 0) {
        // Sewer pipes, volcano slides, and quicksand: forced open
        return GEOMETRY_OPEN;
    }

    // 5. Normal Sub-Tile Geometry (Bits 3..0)
    return (uint8_t)(collision_word & COLLISION_GEOMETRY_MASK);
}

/**
 * Updates entity elevation plane when stepping onto ordinary tiles.
 * Corresponds to $8F:A914.
 */
void update_entity_plane(uint16_t collision_word, uint8_t *entity_plane) {
    // Standing on Always-Walkable (bit 13) or Plane-Transparent (bit 6) preserves plane
    if ((collision_word & (COLLISION_FLAG_AW | COLLISION_FLAG_PT)) == 0) {
        *entity_plane = (uint8_t)(collision_word & COLLISION_PLANE_MASK);
    }
}
