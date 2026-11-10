/*
 * $8F:AA05 calc_8way_direction_from_coordinate_deltas (knowledge/routines/calc_8way_direction_from_coordinate_deltas.md), RTL, 16-bit A.
 *
 * Resolves 8-way cardinal/diagonal direction (0..14 even) from signed 16-bit deltas dx ($12) and dy ($14):
 * - If abs(dx) == abs(dy): diagonal (0x02 NE, 0x06 SE, 0x0A SW, 0x0E NW).
 * - If abs(dy) > abs(dx): vertical dominant (0x00 North if dy < 0, 0x08 South if dy >= 0).
 * - If abs(dx) > abs(dy): horizontal dominant (0x04 East if dx >= 0, 0x0C West if dx < 0).
 * Stores abs(dx) into DP $16.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   calc_8way_direction_from_coordinate_deltas ($8FAA05) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  39 instructions (76 bytes)
 * - Compiled C ASM:   233 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      63b47a1ef367cd37
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(calc_8way_direction_from_coordinate_deltas, 0x8FAA05, RTL)
{
    uint16_t a;
    uint16_t abs_dx, abs_dy;
    int16_t dx, dy;

    SOE_AT(0xAA05);
    dx = (int16_t)DP16(r, 0x12);
    r->a = (uint16_t)dx;
    soe_nz16(r, r->a);
    if (dx == 0) {
        goto vertical;
    }

    if (dx < 0) {
        a = (uint16_t)(dx - 1);
        a ^= 0xFFFF;
    } else {
        a = (uint16_t)dx;
    }
    abs_dx = a;
    DP16(r, 0x16) = abs_dx;

    SOE_AT(0xAA11);
    dy = (int16_t)DP16(r, 0x14);
    r->a = (uint16_t)dy;
    soe_nz16(r, r->a);
    if (dy < 0) {
        a = (uint16_t)(dy - 1);
        a ^= 0xFFFF;
    } else {
        a = (uint16_t)dy;
    }
    abs_dy = a;
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, abs_dy, abs_dx);

    SOE_AT(0xAA1B);
    if (r->p & SOE_Z) {
        goto diagonal;
    }
    if (!(r->p & SOE_N)) {
        goto vertical;
    }

    SOE_AT(0xAA1F);
    r->a = (uint16_t)dx;
    soe_nz16(r, (uint16_t)dx);
    if (dx < 0) {
        SOE_AT(0xAA23);
        r->a = 0x000C;
    } else {
        SOE_AT(0xAA27);
        r->a = 0x0004;
    }
    soe_nz16(r, r->a);
    return;

vertical:
    SOE_AT(0xAA2B);
    dy = (int16_t)DP16(r, 0x14);
    r->a = (uint16_t)dy;
    soe_nz16(r, (uint16_t)dy);
    if (dy < 0) {
        SOE_AT(0xAA2F);
        r->a = 0x0000;
    } else {
        SOE_AT(0xAA31);
        r->a = 0x0008;
    }
    soe_nz16(r, r->a);
    return;

diagonal:
    SOE_AT(0xAA35);
    dx = (int16_t)DP16(r, 0x12);
    r->a = (uint16_t)dx;
    soe_nz16(r, (uint16_t)dx);
    dy = (int16_t)DP16(r, 0x14);
    if (dx < 0) {
        if (dy < 0) {
            SOE_AT(0xAA3D);
            r->a = 0x000E;
        } else {
            SOE_AT(0xAA41);
            r->a = 0x000A;
        }
    } else {
        if (dy < 0) {
            SOE_AT(0xAA49);
            r->a = 0x0002;
        } else {
            SOE_AT(0xAA4D);
            r->a = 0x0006;
        }
    }
    soe_nz16(r, r->a);
}
