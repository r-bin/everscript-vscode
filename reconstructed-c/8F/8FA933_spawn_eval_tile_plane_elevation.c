/*
 * $8F:A933 spawn_eval_tile_plane_elevation (knowledge/routines/spawn_eval_tile_plane_elevation.md), RTL, 16-bit A, X, Y.
 *
 * Evaluates tile collision plane and elevation for entity spawn/coordinates at $46, $48:
 * Calls $90:9815 (eval_tile_collision at X=$46, Y=$48).
 * If bit 13 ($2000) is set:
 *   masks A with $0030, sets ramp flag $0040, stores to DP $44.
 * Else:
 *   masks A with $0030, stores to DP $44.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   spawn_eval_tile_plane_elevation ($8FA933) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (28 bytes)
 * - Compiled C ASM:   101 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      239d31f91794757e
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(spawn_eval_tile_plane_elevation, 0x8FA933, RTL)
{
    uint16_t a;

    SOE_AT(0xA933);
    r->x = DP16(r, 0x46);
    r->y = DP16(r, 0x48);
    soe_call_rtl(0x909815UL, r);

    SOE_AT(0xA93B);
    a = r->a;
    soe_bit_imm(r, a, 0x2000);
    if (!(r->p & SOE_Z)) {
        SOE_AT(0xA924);
        a = (uint16_t)((a & 0x0030) | 0x0040);
        r->a = a;
        soe_nz16(r, a);
        DP16(r, 0x44) = a;
        return;
    }

    SOE_AT(0xA940);
    a = (uint16_t)(a & 0x0030);
    r->a = a;
    soe_nz16(r, a);
    DP16(r, 0x44) = a;
}

