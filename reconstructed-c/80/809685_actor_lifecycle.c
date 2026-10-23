/*
 * Routine: $809685 (actor_lifecycle)
 * Bank: $80 (ROM Offset: $009685)
 * Source: docs/disassembly/entities/actor-lifecycle.md
 */

#include <stdint.h>
#include <stdbool.h>

#define ENTITY_POOL_HEAD_ADDR  0x50A7
#define ENTITY_POOL_TAIL_ADDR  0x512F
#define ENTITY_NODE_SIZE       8
#define ENTITY_SLOT_COUNT      17

#define STATUS_SENTINEL_HEAD   0xFFFE
#define STATUS_INACTIVE_FREE   0xFFFF

typedef struct EntityNode {
    uint16_t prev;    // +0x00: Previous node WRAM address
    uint16_t next;    // +0x02: Next node WRAM address
    uint16_t status;  // +0x04: Status (0xFFFE = head, 0xFFFF = inactive)
    uint16_t self;    // +0x06: Node WRAM address
} EntityNode;

typedef struct {
    EntityNode nodes[ENTITY_SLOT_COUNT]; // $7E:50A7 .. $7E:512F
    uint16_t   pool_tail_limit;          // $7E:1276
} EntitySystemPool;

extern EntitySystemPool g_entity_pool;

/**
 * Initializes the circular doubly-linked entity active list.
 * Corresponds to $80:9685.
 */
void init_entity_pool(void) {
    uint16_t prev_addr = ENTITY_POOL_HEAD_ADDR;
    EntityNode *head = &g_entity_pool.nodes[0];
    head->status = STATUS_SENTINEL_HEAD;

    uint16_t current_addr = ENTITY_POOL_HEAD_ADDR + ENTITY_NODE_SIZE; // 0x50AF
    int node_idx = 0;

    while (current_addr < ENTITY_POOL_TAIL_ADDR) {
        EntityNode *prev_node = &g_entity_pool.nodes[node_idx];
        EntityNode *curr_node = &g_entity_pool.nodes[node_idx + 1];

        prev_node->next = current_addr;
        prev_node->self = prev_addr;

        curr_node->prev   = prev_addr;
        curr_node->status = STATUS_INACTIVE_FREE;

        prev_addr = current_addr;
        current_addr += ENTITY_NODE_SIZE;
        node_idx++;
    }

    g_entity_pool.pool_tail_limit = ENTITY_POOL_TAIL_ADDR; // $7E:1276 = 0x512F
}
