# Companion Breadcrumb FIFO Shift Operations & Navigation State

**Addresses**:
- `companion_breadcrumb_fifo_delete_node`: `$8F:9E49` – `$8F:9E76`
- `companion_breadcrumb_fifo_insert_node`: `$8F:9E77` – `$8F:9EA2`
- `companion_waypoint_prune_and_steer`: `$8F:9C24` – `$8F:9CD9`

**ROM Source**: Bank `$8F` (US 1.0)  
**Subsystem**: Actor & Animation Engine / Companion FIFO Breadcrumbs

---

## 1. Overview & Architectural Role

Secret of Evermore maintains a high-frequency breadcrumb history FIFO (First-In, First-Out) ring buffer in WRAM (`$7E:3BC9`..`$7E:3BF5`) tracking the leader player's recent footsteps (up to 15 nodes, 3 bytes per node).

Key mechanisms:
1. **FIFO Pop / Shift Backwards (`companion_breadcrumb_fifo_delete_node`)**:
   When the companion steps onto a breadcrumb waypoint, that node is consumed. The engine decrements the tail offset register (`$7E:3BFF,X -= 3`) and uses the 65816 hardware block move instruction `MVN $7E, $7E` to slide all subsequent waypoint records down by 3 bytes in a single atomic instruction.
2. **FIFO Push / Shift Forwards (`companion_breadcrumb_fifo_insert_node`)**:
   When the leader traverses past a 16-pixel tile threshold, a new waypoint is logged. If an intermediate waypoint needs insertion into the queue, the engine advances the tail offset (`$7E:3BFF,X += 3`) and shifts existing records upward by 3 bytes using `MVP $7E, $7E`.
3. **Queue Prune & Dynamic Steering Stepper (`companion_waypoint_prune_and_steer`)**:
   Evaluates companion navigation flags (`$7E:3C12,X`):
   - Bit 9 (`0x0200`): Direct path override (bypass breadcrumbs).
   - Bit 5 (`0x0020`): Proximity arrival latch (companion is adjacent to leader).
   - If waypoints are exhausted (`queue_head >= queue_tail`), companion stops movement (`velocity = 0`) and clears moving bit 11 in `$0010,Y`.
   - If waypoints remain, calculates direction vector angle to the next node using `$8F:AA51`, checks 8-way adjacent collision via `$8F:9EC3`, and steers the companion's physics velocity vectors.

---

## 2. Data Structures & Memory Layout

```c
// 3-Byte Compact Waypoint Node Structure:
typedef struct BreadcrumbNode {
    uint8_t metatile_x; // +$00: Metatile X coordinate (0..255)
    uint8_t metatile_y; // +$01: Metatile Y coordinate (0..255)
    uint8_t layer_info; // +$02: Bits 5..4: Layer plane, Bits 3..0: Collision geometry
} BreadcrumbNode;

// Companion Navigation State in WRAM ($7E:3BC0..$7E:3C30):
// $7E:3BC9..$7E:3BF5: 15-node breadcrumb array (45 bytes max)
// $7E:3BFF,X: Queue tail byte offset (0..45, multiple of 3)
// $7E:3C01,X: Queue head / anchor pointer
// $7E:3C12,X: Navigation control flags
//   Bit 4 (0x0010): Arrival flag (halted at leader)
//   Bit 5 (0x0020): Proximity latch (within 2px)
//   Bit 9 (0x0200): Direct line-of-sight bypass
//   Bit 12 (0x1000): Sticky leash mode
```

---

## 3. Clean C Decompilation

```c
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

/**
 * Removes a consumed waypoint node from the FIFO queue, shifting subsequent nodes downward.
 * Replaces the 65816 hardware `MVN $7E, $7E` block move.
 *
 * @param node_idx The index of the consumed node to remove
 */
void companion_breadcrumb_fifo_delete_node(uint16_t node_idx) {
    if (g_queue_tail_offset < WAYPOINT_NODE_SIZE) {
        g_queue_tail_offset = 0;
        return;
    }

    g_queue_tail_offset -= WAYPOINT_NODE_SIZE;

    uint16_t byte_offset = node_idx * WAYPOINT_NODE_SIZE;
    if (byte_offset >= g_queue_tail_offset) {
        return;
    }

    // Shift trailing nodes left by 3 bytes
    uint16_t bytes_to_shift = g_queue_tail_offset - byte_offset;
    memmove(&g_breadcrumb_buffer[byte_offset],
            &g_breadcrumb_buffer[byte_offset + WAYPOINT_NODE_SIZE],
            bytes_to_shift);
}

/**
 * Inserts a new waypoint node into the FIFO queue, shifting existing nodes upward.
 * Replaces the 65816 hardware `MVP $7E, $7E` block move.
 *
 * @param insert_idx The index where the new node will be inserted
 * @param new_node Pointer to the 3-byte waypoint node data
 */
void companion_breadcrumb_fifo_insert_node(uint16_t insert_idx, const BreadcrumbNode* new_node) {
    if (g_queue_tail_offset + WAYPOINT_NODE_SIZE > sizeof(g_breadcrumb_buffer)) {
        // Queue full: prune oldest node (index 0) to make room
        companion_breadcrumb_fifo_delete_node(0);
    }

    uint16_t byte_offset = insert_idx * WAYPOINT_NODE_SIZE;
    uint16_t bytes_to_shift = g_queue_tail_offset - byte_offset;

    if (bytes_to_shift > 0) {
        memmove(&g_breadcrumb_buffer[byte_offset + WAYPOINT_NODE_SIZE],
                &g_breadcrumb_buffer[byte_offset],
                bytes_to_shift);
    }

    memcpy(&g_breadcrumb_buffer[byte_offset], new_node, WAYPOINT_NODE_SIZE);
    g_queue_tail_offset += WAYPOINT_NODE_SIZE;
}

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
```
