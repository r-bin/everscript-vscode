/*
 * $90:A6EF cuttable_grass_drain_pending_swaps (knowledge/routines/cuttable_grass_drain_pending_swaps.md), RTL, 16-bit A, X, Y.
 *
 * Steps through 4 slots of the cuttable grass swap queue starting at $0FD0, reading script words
 * from [$8B],Y and applying metatile mutations via $90:A739.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   cuttable_grass_drain_pending_swaps ($90A6EF) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  34 instructions (74 bytes)
 * - Compiled C ASM:   458 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      e81e0f773a398381
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(cuttable_grass_drain_pending_swaps, 0x90A6EF, RTL)
{
    SOE_AT(0xA6EF);
    r->x = ABS16(r, 0x0FD0);
    r->a = 0x0004;
    DP16(r, 0x42) = 0x0004;
    do {
        SOE_AT(0xA6F7);
        r->y = ABSI16(r, 0x0FD2, r->x);
        soe_nz16(r, r->y);
        if (r->y != 0) {
            SOE_AT(0xA6FC);
            r->a = LONG16(SOE_DPPTR(r, 0x8B) + r->y);
            soe_nz16(r, r->a);
            if (r->a == 0) {
                SOE_AT(0xA734);
                ABSI16(r, 0x0FD2, r->x) = 0;
            } else {
                SOE_AT(0xA700);
                DP16(r, 0x02) = r->a;
                r->y = (uint16_t)(r->y + 2);
                r->a = r->y;
                ABSI16(r, 0x0FD2, r->x) = r->a;
                r->a = ABSI16(r, 0x1002, r->x);
                DP16(r, 0x04) = r->a;
                r->a = (uint16_t)(ABSI16(r, 0x1032, r->x) & 0x00FF);
                DP16(r, 0x46) = r->a;
                r->a = (uint16_t)(ABSI16(r, 0x1032 + 1, r->x) & 0x00FF);
                soe_nz16(r, r->a);
                DP16(r, 0x48) = r->a;
                uint16_t saved_x = r->x;
                soe_call_rts(0x90A739, r);
                r->x = saved_x;
            }
        }
        SOE_AT(0xA722);
        r->x = (uint16_t)(r->x + 2);
        DP16(r, 0x42) = (uint16_t)(DP16(r, 0x42) - 1);
        soe_nz16(r, DP16(r, 0x42));
    } while (DP16(r, 0x42) != 0);
    SOE_AT(0xA728);
    soe_cmp16(r, r->x, 0x0030);
    if (r->x == 0x0030) {
        SOE_AT(0xA72D);
        r->x = 0x0000;
        soe_nz16(r, 0x0000);
    }
    SOE_AT(0xA730);
    ABS16(r, 0x0FD0) = r->x;
}
