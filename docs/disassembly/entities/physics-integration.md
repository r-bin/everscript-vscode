# Entity Velocity & Coordinate Physics Integration

- **ROM Location**: Bank `$80` (`$80:96BB` – `$80:96FD`)
- **Primary Function**: `update_entity_physics` (`$80:96BB`)
- **Physics Core Subroutine**: `apply_velocity_and_collision` (`$80:9040`)
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E`
- **WRAM Core Addresses**:
  - `$7E:50A7`: Sentinel head node (`status = 0xFFFE`).
  - `$7E:5127`: Tail node of active entity pool.
  - DP `$02`: Entity world position X (16-bit).
  - DP `$04`: Entity world position Y (16-bit).
  - DP `$06`: Entity elevation Z (16-bit).
  - DP `$26`: Velocity vector X (8-bit signed).
  - DP `$27`: Velocity vector Y (8-bit signed).

---

## 1. Architectural Architecture & Reverse Linked-List Traversal

The physics loop at `$80:96BB` drives per-frame positional updates for all active actors in the game (the boy, the dog, active enemies, NPCs, and spell sprites).

### Reverse Traversal Order
The loop iterates **backwards** through the doubly-linked actor pool, starting at tail slot `$7E:5127` and stepping backward through `node->prev` pointers (`+0x00`) until it encounters the sentinel head node at `$7E:50A7`.
This reverse ordering ensures that child entities, particles, and trailing companions process relative to previous frame parent states without frame-ahead ordering artifacts.

### Node Slot State Filtering
- **Active Node (`status >= 0`)**: Extracts coordinates (`+0x06`..`+0x0A`) and velocity (`+0x0C`..`+0x0D`), invoking `JSL $80:9040` to compute tile collisions and coordinate translation.
- **Sentinel Head (`status == 0xFFFE`)**: End of linked list reached. Calls `JSL $80:9685` (`init_entity_pool`) to reset chain limits and returns.
- **Inactive / Free Node (`status == 0xFFFF`)**: Skips processing and continues to `node->prev`.

---

## 2. Disassembly & Annotations

```assembly
; ==============================================================================
; update_entity_physics ($80:96BB)
; Traverses entity pool backwards applying velocity vectors and collision checks.
; ==============================================================================
$8096BB  8B          PHB               ; Preserve caller Data Bank
$8096BC  F4 7E 7E    PEA $7E7E         ; Push $7E twice
$8096BF  AB          PLB
$8096C0  AB          PLB               ; Data Bank = $7E
$8096C1  AE 27 51    LDX $5127         ; Start at tail node of actor pool

; Node Processing Loop:
$8096C4  BD 04 00    LDA $0004,X       ; Read node status
$8096C7  30 24       BMI $8096ED       ; If negative (0xFFFE sentinel or 0xFFFF free), branch

; Extract Node Physics Parameters:
$8096C9  BD 06 00    LDA $0006,X
$8096CC  85 02       STA $02           ; DP $02 = World coordinate X
$8096CE  BD 08 00    LDA $0008,X
$8096D1  85 04       STA $04           ; DP $04 = World coordinate Y
$8096D3  BD 0A 00    LDA $000A,X
$8096D6  85 06       STA $06           ; DP $06 = Elevation Z
$8096D8  BD 0C 00    LDA $000C,X
$8096DB  85 26       STA $26           ; DP $26 = Velocity vector X
$8096DD  BD 0D 00    LDA $000D,X
$8096E0  85 27       STA $27           ; DP $27 = Velocity vector Y

$8096E2  DA          PHX               ; Preserve current node pointer on stack
$8096E3  22 40 90 80 JSL $809040       ; Apply physics integration & boundary test
$8096E7  7A          PLY               ; Y = restored node pointer
$8096E8  BE 00 00    LDX $0000,Y       ; X = node->prev (step backward towards head)
$8096EB  80 D7       BRA $8096C4       ; Repeat loop

; Non-Active Node Handling:
$8096ED  C9 FE FF    CMP #$FFFE        ; Is this the sentinel head node ($7E:50A7)?
$8096F0  F0 06       BEQ $8096F8       ; Yes -> entire list processed!
$8096F2  9B          TXY               ; Inactive free slot: Y = current node
$8096F3  BE 00 00    LDX $0000,Y       ; Step to node->prev
$8096F6  80 CC       BRA $8096C4       ; Continue loop

; Traversal Complete:
$8096F8  22 85 96 80 JSL $809685       ; Re-link entity active list limits
$8096FC  AB          PLB               ; Restore Data Bank
$8096FD  6B          RTL               ; Return to caller
```

---

## 3. Reconstructed Clean C Implementation

```c
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
```

