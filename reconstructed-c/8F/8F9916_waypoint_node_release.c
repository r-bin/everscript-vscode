/*
 * $8F:9916 waypoint_node_release (knowledge/routines/waypoint_node_release.md), RTL, 16-bit A and X.
 *
 * Push a waypoint node X back onto the free list:
 * Clears node state $3C14,x, sets $3BC9,x to current free head $3BC7, updates head $3BC7 = X.
 * Returns A = $FFFF.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   waypoint_node_release ($8F9916) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (16 bytes)
 * - Compiled C ASM:   62 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      7241b21cea836759
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(waypoint_node_release, 0x8F9916, RTL)
{
    SOE_AT(0x9916);
    ABSI16(r, 0x3C14, r->x) = 0;

    SOE_AT(0x9919);
    ABSI16(r, 0x3BC9, r->x) = RAM16(0x3BC7);

    SOE_AT(0x991F);
    RAM16(0x3BC7) = r->x;

    SOE_AT(0x9922);
    r->a = 0xFFFF;
    soe_nz16(r, 0xFFFF);
}

