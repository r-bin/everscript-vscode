/**
 * Routine: $8F:B46D (entity_collision_check)
 * Bank: $8F (ROM Offset: $0FB46D)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_collision_check ($8FB46D) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  28 instructions (62 bytes)
 * - Compiled C ASM:   239 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a2eb15702fc06534
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_collision_check, 0x8FB46D, RTL);

static uint16_t abs_diff16(uint16_t a, uint16_t b) {
    uint16_t d = (uint16_t)(a - b);
    if (d & 0x8000u) {
        d = (uint16_t)((uint16_t)(d - 1u) ^ 0xFFFFu);
    }
    return d;
}

static bool check_entity_pair(soe_regs r, uint16_t saved_elev) {
    r->x = ABSI16(r, 0x0060u, r->y);
    uint16_t other_r = ROM16(0x8E000Du + r->x);
    r->a = other_r;
    soe_nz16(r, other_r);
    if (other_r == 0u) {
        return false;
    }
    r->p &= (uint8_t)~SOE_C;
    uint16_t sum_r = soe_adc16(r, other_r, DP16(r, 0x16u));
    DP16(r, 0x18u) = sum_r;

    uint16_t dy2 = (uint16_t)(abs_diff16(ABSI16(r, 0x001Cu, r->y), DP16(r, 0x48u)) << 1);
    r->a = dy2;
    soe_cmp16(r, dy2, sum_r);
    if (r->p & SOE_C) {
        return false;
    }

    uint16_t dx = abs_diff16(ABSI16(r, 0x001Au, r->y), DP16(r, 0x46u));
    r->a = dx;
    soe_cmp16(r, dx, sum_r);
    if (r->p & SOE_C) {
        return false;
    }

    uint16_t dz = abs_diff16(ABSI16(r, 0x001Eu, r->y), saved_elev);
    r->a = dz;
    soe_cmp16(r, dz, 0x0230u);
    if (r->p & SOE_C) {
        return false;
    }

    uint16_t flags = ABSI16(r, 0x0018u, r->y);
    r->a = flags;
    if ((flags & 0x0040u) == 0u) {
        uint16_t xor_plane = (uint16_t)(flags ^ DP16(r, 0x44u));
        r->a = xor_plane;
        if (xor_plane != 0u && (xor_plane & 0x0040u) == 0u) {
            soe_nz16(r, xor_plane);
            return false;
        }
    }

    r->x = DP16(r, 0x4Cu);
    uint16_t cur_dy2 = (uint16_t)(abs_diff16(ABSI16(r, 0x001Cu, r->y), ABSI16(r, 0x001Cu, r->x)) << 1);
    r->a = cur_dy2;
    soe_cmp16(r, cur_dy2, sum_r);
    if (r->p & SOE_C) {
        r->x = DP16(r, 0x4Cu);
        soe_call_rts(0x8FB52Cu, r);
        soe_carry(r, false);
        return true;
    }

    uint16_t cur_dx = abs_diff16(ABSI16(r, 0x001Au, r->y), ABSI16(r, 0x001Au, r->x));
    r->a = cur_dx;
    soe_cmp16(r, cur_dx, sum_r);
    if (r->p & SOE_C) {
        r->x = DP16(r, 0x4Cu);
        soe_call_rts(0x8FB52Cu, r);
        soe_carry(r, false);
        return true;
    }

    soe_nz16(r, cur_dx);
    return false;
}

void entity_collision_check_bind(soe_regs r) {
    r->y = DP16(r, 0x4Cu);
    r->x = ABSI16(r, 0x0060u, r->y);
    uint16_t flags = ROM16(0x8E000Du + r->x);
    r->a = flags;
    soe_nz16(r, flags);
    if (flags == 0u) {
        soe_carry(r, true);
        return;
    }
    DP16(r, 0x16u) = flags;
    uint16_t saved_elev = ABSI16(r, 0x001Eu, r->y);
    if (r->y < 0x4E89u) {
        if (ABS16(r, 0x4F61u) != 0u) {
            r->y = 0x4F37u;
            if (check_entity_pair(r, saved_elev)) {
                return;
            }
        }
        r->y = 0x4E89u;
        if (check_entity_pair(r, saved_elev)) {
            return;
        }
        r->a = saved_elev;
        soe_nz16(r, saved_elev);
        soe_carry(r, true);
        return;
    }
    r->y = ABS16(r, 0x3DDFu);
    for (;;) {
        if (r->y < 0x4E89u) {
            if (check_entity_pair(r, saved_elev)) {
                return;
            }
        }
        uint16_t next = ABSI16(r, 0x005Eu, r->y);
        r->a = next;
        r->y = next;
        if (next == 0u) {
            break;
        }
    }
    r->a = saved_elev;
    soe_nz16(r, saved_elev);
    soe_carry(r, true);
}
