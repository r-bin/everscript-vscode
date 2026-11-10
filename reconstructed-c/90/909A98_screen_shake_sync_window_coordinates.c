/*
 * $90:9A98 screen_shake_sync_window_coordinates (knowledge/routines/screen_shake_sync_window_coordinates.md), RTS, 16-bit A.
 *
 * Synchronizes camera screen coordinates to window boundary registers:
 * Reads camera horizontal scroll DP $59 and copies to $010E (BG1HOFS) and $0112 (BG2HOFS).
 * Reads camera vertical scroll DP $5B, decrements by 1, and copies to $0110 (BG1VOFS) and $0114 (BG2VOFS).
 * Leaves A = $5B - 1, N Z from the decremented value.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   screen_shake_sync_window_coordinates ($909A98) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  8 instructions (18 bytes)
 * - Compiled C ASM:   88 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5451c2f3276c2234
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(screen_shake_sync_window_coordinates, 0x909A98, RTS)
{
    uint16_t hofs;
    uint16_t vofs;

    SOE_AT(0x9A98);
    hofs = DP16(r, 0x59);
    ABS16(r, PPU_SHADOW_BG1HOFS_ADDR) = hofs;
    ABS16(r, PPU_SHADOW_BG2HOFS_ADDR) = hofs;

    SOE_AT(0x9AA0);
    vofs = (uint16_t)(DP16(r, 0x5B) - 1);
    ABS16(r, PPU_SHADOW_BG1VOFS_ADDR) = vofs;
    ABS16(r, PPU_SHADOW_BG2VOFS_ADDR) = vofs;
    r->a = vofs;
    soe_nz16(r, vofs);
}
