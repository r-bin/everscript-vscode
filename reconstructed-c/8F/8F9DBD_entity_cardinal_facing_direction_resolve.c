/*
 * $8F:9DBD entity_cardinal_facing_direction_resolve, RTS, 16-bit A/X/Y.
 *
 * Calculates the 8-way facing direction (0, 2, 4, 6, 8, 10, 12, 14) and proximity distance
 * between target coordinates (X = target X, A = target Y) and entity coordinates at +$1A,y / +$1C,y in DB.
 * Stores facing direction to +$22,y, and if distance < 16, stores distance to +$64,y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_cardinal_facing_direction_resolve ($8F9DBD) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  65 instructions (140 bytes)
 * - Compiled C ASM:   656 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      7892b5fc99306e1f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(entity_cardinal_facing_direction_resolve, 0x8F9DBD, RTS)
{
    uint16_t target_y = r->a;
    uint16_t target_x = r->x;
    uint16_t y = r->y;

    int16_t dy = (int16_t)(target_y - ABSI16(r, 0x001C, y));
    DP16(r, 0x14) = (uint16_t)dy;

    int16_t dx = (int16_t)(target_x - ABSI16(r, 0x001A, y));
    DP16(r, 0x12) = (uint16_t)dx;

    uint16_t dist = 0;
    uint16_t facing = 0;
    bool carry = false;

    if (dx > 0) {
        if (dy > 0) {
            facing = 6;
            ABSI16(r, 0x0022, y) = facing;
            carry = ((uint16_t)dx >= (uint16_t)dy);
            dist = (uint16_t)dx < (uint16_t)dy ? (uint16_t)dx : (uint16_t)dy;
        } else if (dy == 0) {
            facing = 4;
            ABSI16(r, 0x0022, y) = facing;
            carry = true;
            dist = (uint16_t)dx;
        } else {
            uint16_t abs_dy = (uint16_t)(-dy);
            DP16(r, 0x14) = abs_dy;
            facing = 2;
            ABSI16(r, 0x0022, y) = facing;
            carry = ((uint16_t)dx >= abs_dy);
            dist = (uint16_t)dx < abs_dy ? (uint16_t)dx : abs_dy;
        }
    } else if (dx == 0) {
        if (dy > 0) {
            facing = 8;
            ABSI16(r, 0x0022, y) = facing;
            carry = true;
            dist = (uint16_t)dy;
        } else if (dy == 0) {
            uint16_t tdc = r->d;
            ABSI16(r, 0x0064, y) = tdc;
            r->a = tdc;
            soe_nz16(r, tdc);
            r->p |= SOE_C;
            return;
        } else {
            uint16_t abs_dy = (uint16_t)(-dy);
            DP16(r, 0x14) = abs_dy;
            facing = 0;
            ABSI16(r, 0x0022, y) = facing;
            carry = true;
            dist = abs_dy;
        }
    } else {
        uint16_t abs_dx = (uint16_t)(-dx);
        DP16(r, 0x12) = abs_dx;
        if (dy > 0) {
            facing = 10;
            ABSI16(r, 0x0022, y) = facing;
            carry = (abs_dx >= (uint16_t)dy);
            dist = abs_dx < (uint16_t)dy ? abs_dx : (uint16_t)dy;
        } else if (dy == 0) {
            facing = 12;
            ABSI16(r, 0x0022, y) = facing;
            carry = false;
            dist = abs_dx;
        } else {
            uint16_t abs_dy = (uint16_t)(-dy);
            DP16(r, 0x14) = abs_dy;
            facing = 14;
            ABSI16(r, 0x0022, y) = facing;
            carry = (abs_dx >= abs_dy);
            dist = abs_dx < abs_dy ? abs_dx : abs_dy;
        }
    }

    r->a = dist;
    /* BIT imm (opcode 0x89) only affects Z; N/V are preserved, C is set by CMP or SBC */
    bool z = (dist & 0xFFF0) == 0;
    r->p = (uint8_t)((r->p & ~(SOE_N | SOE_Z | SOE_C)) | (dist & 0x8000 ? SOE_N : 0) | (z ? SOE_Z : 0) | (carry ? SOE_C : 0));
    if (z) {
        ABSI16(r, 0x0064, y) = dist;
    }
}
