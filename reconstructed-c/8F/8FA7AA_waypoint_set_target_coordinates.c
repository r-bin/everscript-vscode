/**
 * Routine: $8F:A7AA (waypoint_set_target_coordinates)
 * Bank: $8F (ROM Offset: $0FA7AA)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   waypoint_set_target_coordinates ($8FA7AA) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  57 instructions (122 bytes)
 * - Compiled C ASM:   241 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      72b67d74b9fe6f04
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_dp.h"
#include "soe_ram.h"

SOE_BIND(waypoint_set_target_coordinates, 0x8FA7AA, RTL);

/**
 * Stores destination coordinates from DP $46/$48/$44 into the waypoint slot at
 * $4E (both pixel coordinates and 16px tile coordinates), clears $3C16,x, and
 * tail-jumps to the proximity evaluation helper ($8F:A723).
 */
void waypoint_set_target_coordinates_bind(soe_regs r) {
    uint16_t slot = DP16(r, DP_CHILD_RECORD);
    uint16_t px_x = DP16(r, 0x46u);
    uint16_t px_y = DP16(r, 0x48u);

    r->x = slot;
    ABS16(r, (uint16_t)(slot + COMPANION_WAYPOINT_TARGET_X_ADDR)) = px_x;
    ABS16(r, (uint16_t)(slot + COMPANION_WAYPOINT_16_COORDS_ADDR)) = (uint16_t)(px_x >> 4);
    ABS16(r, (uint16_t)(slot + COMPANION_WAYPOINT_TARGET_Y_ADDR)) = px_y;

    uint16_t shifted_y = (uint16_t)(px_y >> 4);
    ABS8(r, (uint16_t)(slot + 0x3BFAu)) = (uint8_t)shifted_y;
    uint8_t z_val = DP8(r, 0x44u);
    ABS8(r, (uint16_t)(slot + 0x3BFBu)) = z_val;

    r->a = (uint16_t)((shifted_y & 0xFF00u) | z_val);
    ABS16(r, (uint16_t)(slot + 0x3C16u)) = 0u;
    r->p &= (uint8_t)~(SOE_M | SOE_X);
    soe_nz8(r, z_val);

    soe_call_rtl(0x8FA723u, r);
}
