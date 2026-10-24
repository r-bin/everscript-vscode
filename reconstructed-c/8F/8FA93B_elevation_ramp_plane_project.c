/*
 * $8F:A93B elevation_ramp_plane_project (knowledge/rom/8fa93b.md), RTL, 16-bit A.
 *
 * In: A = a metatile collision word. DP $44 = word & $30, with $40 added when the word has bit 13
 * (shared tail with update_entity_plane at $8F:A924). Leaves A = the value, N Z from it.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   elevation_ramp_plane_project ($8FA93B) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (20 bytes)
 * - Compiled C ASM:   42 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      e090a30777b706f6
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(elevation_ramp_plane_project, 0x8FA93B, RTL)
{
    uint16_t a = (uint16_t)(r->a & 0x0030);

    if (r->a & 0x2000) a |= 0x0040;
    soe_nz16(r, a);
    DP16(r, 0x44) = a;
    r->a = a;
}