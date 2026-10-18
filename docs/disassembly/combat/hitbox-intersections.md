# Hitbox Damage Intersections, Elliptical Collision & Knockback Vectors ($8F:B46D, $8F:B4AB, $8F:C0D3)

> **Subsystem**: Combat Hitbox Resolution, Entity Collision & Hurtbox Reaction  
> **ROM Addresses**: `$8F:B46D` (`entity_collision_check`), `$8F:B4AB` (`test_entity_pair_overlap`), `$8F:C0D3` (`dispatch_hit_reaction_and_knockback`)  
> **Clean C Module**: `combat/hitbox-intersections.c`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore utilizes an isometric/elliptical collision model for entity bodies, distinct from axis-aligned bounding boxes (AABBs):
- **Collision Radius (`character +0x0D`)**:
  - Each character record defines a collision radius $r$ in pixels (e.g., Boy = 8, Dog = 16, Flowers = 14, Raptors = 20, Thraxx claws = 24).
- **Isometric Overlap Formula (`$8F:B4AB`)**:
  - Two entities collide if and only if:
    $$|dx| < (r_1 + r_2) \quad \text{AND} \quad 2 \cdot |dy| < (r_1 + r_2)$$
  - Because SNES Mode 7 and top-down isometric perspectives project vertical distances foreshortened by $\approx 50\%$, the collision boundary is an ellipse with twice the width of its height ($2:1$ aspect ratio).
- **Overlapping Mover Rule (`$8F:B4FD`)**:
  - If two entities already overlap prior to movement (e.g., spawning on the same coordinate), movement is *not* blocked, preventing softlocks.
- **Hurtbox Strike & Knockback Dispatch (`$8F:C0D3`)**:
  - When struck by an attack or spell:
    1. Sets invulnerability flash frames in `target +0x14` (typically 30–60 frames).
    2. Spawns floating damage numbers via `$8F:C09A` (white for physical damage, orange for spell damage, blue for heal).
    3. Calculates knockback displacement vector:
       $$\vec{v}_{\text{knockback}} = \text{normalize}(\vec{P}_{\text{target}} - \vec{P}_{\text{attacker}}) \times \text{knockback\_speed}$$
    4. Integrates displacement across 8 frames while testing against metatile tile collision (`$90:9DE8`).

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; $8F:B46D: Check Entity Movement Against Other Active Entities
; ==============================================================================
$8F:B46D  8B           PHB
$8F:B46E  F4 7E 7E     PEA $7E7E
$8F:B471  AB           PLB
$8F:B472  AB           PLB              ; DB = $7E
$8F:B473  BF 0D 00 8E  LDA $8E000D,X    ; Mover's collision radius (+0x0D)
$8F:B477  F0 1C        BEQ $B495        ; Radius == 0 (no body) -> never blocks
$8F:B479  85 16        STA $16          ; Store mover radius in DP $16

; Iterate over active entity linked list
$8F:B47B  A0 89 4E     LDY #$4E89       ; Start at first entity
$8F:B47E  B9 10 00     LDA $0010,Y      ; Read entity status
$8F:B481  89 01 00     BIT #$0001       ; Active flag?
$8F:B484  F0 0F        BEQ $B495        ; Inactive -> next
$8F:B486  20 AB B4     JSR $B4AB        ; Test overlap with candidate
$8F:B489  90 0A        BCC $B495        ; No collision
$8F:B48B  18           CLC              ; Collision detected: move BLOCKED!
$8F:B48C  AB           PLB
$8F:B48D  6B           RTL

; ==============================================================================
; $8F:B4AB: Test Pair Overlap Rule
; ==============================================================================
$8F:B4AB  BF 0D 00 8E  LDA $8E000D,X    ; Candidate's collision radius
$8F:B4AF  F0 4B        BEQ $B4FC        ; Radius == 0 -> pass through
$8F:B4B1  18           CLC
$8F:B4B2  65 16        ADC $16          ; Sum of radii: r1 + r2
$8F:B4B4  85 18        STA $18          ; Store sum in DP $18

; Vertical Check: 2 * |dy| < sum_radii
$8F:B4B6  B9 1C 00     LDA $001C,Y      ; Candidate Y
$8F:B4B9  38           SEC
$8F:B4BA  E5 48        SBC $48          ; Target Y
$8F:B4BC  10 05        BPL $B4C3
$8F:B4BE  49 FF FF     EOR #$FFFF       ; Absolute value |dy|
$8F:B4C1  1A           INC A
$8F:B4C2  0A           ASL A            ; Double |dy|! (2:1 isometric aspect)
$8F:B4C3  C5 18        CMP $18
$8F:B4C5  B0 35        BCS $B4FC        ; 2 * |dy| >= sum -> miss

; Horizontal Check: |dx| < sum_radii
$8F:B4C7  B9 1A 00     LDA $001A,Y      ; Candidate X
$8F:B4CA  38           SEC
$8F:B4CB  E5 46        SBC $46          ; Target X
$8F:B4CD  10 05        BPL $B4D4
$8F:B4CF  49 FF FF     EOR #$FFFF       ; Absolute value |dx|
$8F:B4D2  1A           INC A
$8F:B4D3  C5 18        CMP $18
$8F:B4D5  B0 25        BCS $B4FC        ; |dx| >= sum -> miss

; Overlapping Mover Check ($8FB4FD):
; If mover is ALREADY overlapping at current coordinate, allow movement!
$8F:B4D7  ...
$8F:B4FB  38           SEC              ; Newly blocked!
$8F:B4FC  60           RTS
```

---

## 3. Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <math.h>

#define ENT_OFF_FLAGS_14        0x14  /* Invulnerability and flash timers */
#define ENT_OFF_POS_X           0x1A
#define ENT_OFF_POS_Y           0x1C
#define ENT_OFF_VEL_X           0x20
#define ENT_OFF_VEL_Y           0x22
#define ENT_OFF_CHAR_RECORD     0x60
#define CHAR_OFF_RADIUS         0x0D

/**
 * Tests whether two entities with radii r1 and r2 overlap at given coordinates ($8F:B4AB).
 * Implements the isometric 2:1 ellipse collision formula.
 *
 * @param x1, y1 First entity world coordinates.
 * @param r1     First entity radius.
 * @param x2, y2 Second entity world coordinates.
 * @param r2     Second entity radius.
 * @return True if collision boxes overlap.
 */
bool test_isometric_overlap(int16_t x1, int16_t y1, uint8_t r1,
                            int16_t x2, int16_t y2, uint8_t r2) {
    if (r1 == 0 || r2 == 0) {
        return false; // Zero radius entities have no body and never collide
    }

    uint16_t sum_radii = (uint16_t)r1 + (uint16_t)r2;
    uint16_t dx = (uint16_t)abs(x2 - x1);
    uint16_t dy = (uint16_t)abs(y2 - y1);

    // Vertical check: doubled vertical distance for 2:1 isometric ratio
    if ((dy << 1) >= sum_radii) {
        return false;
    }

    // Horizontal check
    if (dx >= sum_radii) {
        return false;
    }

    return true;
}

/**
 * Validates whether an entity can step onto destination coordinate (target_x, target_y) ($8F:B46D).
 *
 * @param mover_ptr WRAM address of the moving entity.
 * @param target_x  Proposed new X coordinate.
 * @param target_y  Proposed new Y coordinate.
 * @return True if the move is allowed, false if blocked by another entity.
 */
bool entity_collision_check(uint16_t mover_ptr, int16_t target_x, int16_t target_y) {
    uint16_t mover_char = read_wram16(mover_ptr + ENT_OFF_CHAR_RECORD);
    uint8_t mover_radius = read_rom8(0x8E0000 + mover_char + CHAR_OFF_RADIUS);
    if (mover_radius == 0) {
        return true; // No body: move always permitted
    }

    int16_t cur_x = (int16_t)read_wram16(mover_ptr + ENT_OFF_POS_X);
    int16_t cur_y = (int16_t)read_wram16(mover_ptr + ENT_OFF_POS_Y);

    // Iterate through active entities
    for (uint16_t candidate = 0x4E89; candidate != 0; candidate = get_next_entity(candidate)) {
        if (candidate == mover_ptr) continue;

        uint16_t cand_char = read_wram16(candidate + ENT_OFF_CHAR_RECORD);
        uint8_t cand_radius = read_rom8(0x8E0000 + cand_char + CHAR_OFF_RADIUS);
        if (cand_radius == 0) continue;

        int16_t cand_x = (int16_t)read_wram16(candidate + ENT_OFF_POS_X);
        int16_t cand_y = (int16_t)read_wram16(candidate + ENT_OFF_POS_Y);

        // Check if target position would cause collision
        if (test_isometric_overlap(target_x, target_y, mover_radius, cand_x, cand_y, cand_radius)) {
            // Already overlapping check: If entities already intersect at current position, allow move!
            if (test_isometric_overlap(cur_x, cur_y, mover_radius, cand_x, cand_y, cand_radius)) {
                continue;
            }
            return false; // Blocked!
        }
    }

    return true;
}

/**
 * Dispatches hit reaction, invulnerability flash, and knockback velocity ($8F:C0D3).
 *
 * @param target_ptr   WRAM address of victim entity.
 * @param attacker_ptr WRAM address of attacker (or 0 for projectile).
 * @param damage       Damage points dealt.
 * @param knockback_px Knockback displacement magnitude.
 */
void dispatch_hit_reaction_and_knockback(uint16_t target_ptr, uint16_t attacker_ptr,
                                        uint16_t damage, uint8_t knockback_px) {
    // 1. Set invulnerability flash frames (30 frames)
    uint16_t flags14 = read_wram16(target_ptr + ENT_OFF_FLAGS_14);
    write_wram16(target_ptr + ENT_OFF_FLAGS_14, (flags14 & ~0x00FF) | 30);

    // 2. Dispatch floating damage number popup
    int16_t tx = (int16_t)read_wram16(target_ptr + ENT_OFF_POS_X);
    int16_t ty = (int16_t)read_wram16(target_ptr + ENT_OFF_POS_Y);
    spawn_floating_damage_number(tx, ty - 16, damage, 0 /* white */);

    // 3. Compute knockback vector away from impact source
    if (attacker_ptr != 0 && knockback_px > 0) {
        int16_t ax = (int16_t)read_wram16(attacker_ptr + ENT_OFF_POS_X);
        int16_t ay = (int16_t)read_wram16(attacker_ptr + ENT_OFF_POS_Y);

        int16_t dx = tx - ax;
        int16_t dy = ty - ay;
        double dist = sqrt((double)(dx * dx + dy * dy));

        if (dist > 0.01) {
            int16_t vx = (int16_t)((dx / dist) * knockback_px);
            int16_t vy = (int16_t)((dy / dist) * knockback_px);

            // Apply knockback velocity displacement
            write_wram16(target_ptr + ENT_OFF_VEL_X, vx);
            write_wram16(target_ptr + ENT_OFF_VEL_Y, vy);
        }
    }
}
```
