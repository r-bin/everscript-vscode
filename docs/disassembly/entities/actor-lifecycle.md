# Actor & Entity Active Pool Initialization

- **ROM Location**: Bank `$80` (`$80:9685` – `$80:96BA`)
- **Primary Function**: `init_entity_pool` (`$80:9685`)
- **Invoked By**: Main engine frame setup (`$80:8BB5`)
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E`
- **WRAM Core Addresses**:
  - `$7E:50A7`–`$7E:512F`: Circular doubly-linked list of active actor nodes (17 slots $\times$ 8 bytes = 136 bytes).
  - `$7E:1276`: Tail boundary address of entity linked list pool (`0x512F`).

---

## 1. Architectural Architecture & Doubly-Linked Actor Pool

Secret of Evermore manages all on-screen interactive actors (boy, dog, NPCs, enemies, projectiles) using an active entity list allocated in WRAM bank `$7E`.

### Node Structure (8 Bytes Per Node)
The allocator at `$80:9685` formats 17 node headers of 8 bytes each:
- `+0x00`: `prev` pointer (16-bit address in `$7E:xxxx`)
- `+0x02`: `next` pointer (16-bit address in `$7E:xxxx`)
- `+0x04`: `status` / slot state:
  - `0xFFFE`: Sentinel / List head marker
  - `0xFFFF`: Inactive / Unallocated free slot
  - `0x0000`..: Active entity index / type
- `+0x06`: Self pointer / backlink

### Pool Layout (17 Slots)
- **Slot 0 (`$7E:50A7`)**: Sentinel head node.
- **Slots 1..16 (`$7E:50AF`..`$7E:5127`)**: Free actor slots chained into the unallocated pool.
- **End boundary (`$7E:512F`)**: Upper bound written to `$7E:1276`.

---

## 2. Disassembly & Annotations

```assembly
; ==============================================================================
; init_entity_pool ($80:9685)
; Formats the active actor circular doubly-linked list nodes in WRAM $7E:50A7..$512F
; ==============================================================================
$809685  8B          PHB               ; Preserve Data Bank
$809686  F4 7E 7E    PEA $7E7E         ; Push $7E
$809689  AB          PLB
$80968A  AB          PLB               ; Data Bank = $7E

$80968B  A2 A7 50    LDX #$50A7        ; X = Base of entity node pool (Head node)
$80968E  A9 FE FF    LDA #$FFFE        ; Sentinel status marker
$809691  9D 04 00    STA $0004,X       ; head->status = 0xFFFE
$809694  18          CLC

; Loop over remaining slots (8 bytes each):
$809695  A9 AF 50    LDA #$50AF        ; First free slot address
$809698  A8          TAY               ; Y = current node address
$809699  9D 02 00    STA $0002,X       ; prev_node->next = current_node
$80969C  8A          TXA               ; A = prev_node address
$80969D  9D 06 00    STA $0006,X       ; prev_node->self = prev_node
$8096A0  99 00 00    STA $0000,Y       ; current_node->prev = prev_node
$8096A3  A9 FF FF    LDA #$FFFF        ; Inactive slot marker
$8096A6  99 04 00    STA $0004,Y       ; current_node->status = 0xFFFF
$8096A9  BB          TYX               ; X becomes current node
$8096AA  98          TYA               ; A = current node address
$8096AB  69 08 00    ADC #$0008        ; Advance to next 8-byte node
$8096AE  C9 2F 51    CMP #$512F        ; Reached tail of pool?
$8096B1  D0 E5       BNE $809698       ; Loop until all 17 slots initialized

$8096B3  A9 2F 51    LDA #$512F        ; Tail boundary address
$8096B6  8D 76 12    STA $1276         ; Save pool tail limit ($7E:1276)
$8096B9  AB          PLB               ; Restore Data Bank
$8096BA  6B          RTL               ; Return to caller
```

---

## 3. Reconstructed Clean C Implementation

```c
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
```

