/*
 * Routine: $8096BB (physics_integration)
 * Bank: $80 (ROM Offset: $0096BB)
 * Source: docs/disassembly/entities/physics-integration.md
 */

#include <stdint.h>
#include <stdbool.h>

#define STATUS_SENTINEL_HEAD 0xFFFE
#define STATUS_INACTIVE_FREE 0xFFFF

typedef struct ActorNode {
    uint16_t prev_addr;   // +0x00: Pointer to previous node in $7E
    uint16_t next_addr;   // +0x02: Pointer to next node in $7E
    uint16_t status;      // +0x04: Slot status / entity type
    uint16_t pos_x;       // +0x06: World X position
    uint16_t pos_y;       // +0x08: World Y position
    uint16_t pos_z;       // +0x0A: World elevation Z
    int8_t   vel_x;       // +0x0C: X velocity vector
    int8_t   vel_y;       // +0x0D: Y velocity vector
    uint16_t flags;       // +0x0E: Entity movement flags
} ActorNode;

typedef struct {
    uint8_t wram[0x20000]; // SNES Bank $7E/$7F
} GameWram;

extern GameWram g_wram;
extern void init_entity_pool(void);
extern void apply_velocity_and_collision(ActorNode *actor);

/**
 * Traverses active actors backwards, integrating velocities and updating collision states.
 * Corresponds to $80:96BB.
 */
void update_entity_physics(void) {
    // Start at tail node ($7E:5127)
    uint16_t current_addr = 0x5127;

    while (true) {
        ActorNode *node = (ActorNode *)&g_wram.wram[current_addr];

        if ((node->status & 0x8000) == 0) {
            // Active entity: apply physics vector and tile collisions ($80:9040)
            apply_velocity_and_collision(node);
            current_addr = node->prev_addr;
        } else if (node->status == STATUS_SENTINEL_HEAD) {
            // Reached head of list ($7E:50A7)
            break;
        } else {
            // Inactive / unallocated node (0xFFFF): step backward
            current_addr = node->prev_addr;
        }
    }

    // Refresh entity active list limits
    init_entity_pool();
}
