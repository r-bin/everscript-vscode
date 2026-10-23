/*
 * Routine: $8FB46D (hitbox_intersections)
 * Bank: $8F (ROM Offset: $0FB46D)
 * Source: docs/disassembly/combat/hitbox-intersections.md
 */

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
