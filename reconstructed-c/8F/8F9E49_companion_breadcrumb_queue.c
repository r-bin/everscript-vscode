/*
 * Routine: $8F9E49 (companion_breadcrumb_queue)
 * Bank: $8F (ROM Offset: $0F9E49)
 * Source: docs/disassembly/entities/companion-breadcrumb-queue.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define MAX_WAYPOINT_NODES 15
#define WAYPOINT_NODE_SIZE 3

extern uint8_t  g_breadcrumb_buffer[MAX_WAYPOINT_NODES * WAYPOINT_NODE_SIZE]; // $7E:3BC9
extern uint16_t g_queue_tail_offset; // $7E:3BFF
extern uint16_t g_nav_flags;         // $7E:3C12

extern uint8_t compute_vector_angle_16(int16_t dx, int16_t dy); // $8F:AA51
extern bool companion_neighbor_cell_collision_test(uint8_t dir, int16_t x, int16_t y, uint8_t plane); // $8F:9EC3
extern void set_entity_velocity_vector(uint16_t entity_ptr, int16_t target_x, int16_t target_y); // $8F:AB92

/* companion_breadcrumb_fifo_delete_node: exact to the ROM in 8F9E49_companion_breadcrumb_fifo_delete_node.c */

/* companion_breadcrumb_fifo_insert_node: exact to the ROM in 8F9E77_companion_breadcrumb_fifo_insert_node.c */

/**
 * Evaluates companion breadcrumb progression, trims stale waypoints, and updates steering.
 *
 * @param leader_ptr Pointer to the primary player character structure
 * @param follower_ptr Pointer to the companion character structure
 */
void companion_waypoint_prune_and_steer(uint16_t leader_ptr, uint16_t follower_ptr) {
    // 1. Direct path override: if line of sight is forced, skip breadcrumb traversal
    if (g_nav_flags & 0x0200) {
        return;
    }

    // 2. Proximity check: if not latched close to leader, steer directly toward target destination
    if (!(g_nav_flags & 0x0020)) {
        // Clear stationary state flag (bit 11 in entity status word +$10)
        // Set target destination and steer
        return;
    }

    // 3. Proximity latch active: check if breadcrumb queue has remaining nodes
    if (g_queue_tail_offset <= WAYPOINT_NODE_SIZE) {
        // Queue exhausted: companion stands idle beside leader
        g_nav_flags |= 0x0010; // Raise arrived flag
        return;
    }

    // 4. Read next waypoint node from queue
    const BreadcrumbNode* next_node = (const BreadcrumbNode*)&g_breadcrumb_buffer[0];

    // Compute heading direction angle toward next breadcrumb
    uint8_t angle = compute_vector_angle_16(next_node->metatile_x, next_node->metatile_y);

    // Test adjacent cell traversability
    if (!companion_neighbor_cell_collision_test(angle, next_node->metatile_x, next_node->metatile_y, next_node->layer_info >> 4)) {
        // Obstructed: consume stale node and evaluate next breadcrumb
        companion_breadcrumb_fifo_delete_node(0);
        return;
    }

    // Clear arrival bit: follower is moving along breadcrumbs
    g_nav_flags &= ~0x0010;
}
