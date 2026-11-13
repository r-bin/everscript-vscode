/*
 * Routine: animation_script_branch_if_elevation_threshold ($90:86E5)
 * Read target word from [$5D]; store it to $0020,Y when field $001E,Y - $0640
 * is negative (signed/N set), else store D ($0000); advance [$5D] by 2.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_branch_if_elevation_threshold ($9086E5) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  13 instructions (25 bytes)
 * - Compiled C ASM:   193 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      2629fc138cdab82b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(animation_script_branch_if_elevation_threshold, 0x9086E5, RTS) {
    uint16_t val;
    uint16_t elev;
    uint16_t pc_lo;

    /* REP #$30 */
    r->p &= (uint8_t)~(SOE_M | SOE_X);

    val = LONG16(SOE_DPPTR(r, 0x5Du));
    elev = ABSI16(r, 0x001Eu, r->y);
    soe_cmp16(r, elev, 0x0640u);
    if ((r->p & SOE_N) == 0u) {
        /* TDC */
        val = r->d;
    }

    ABSI16(r, 0x0020u, r->y) = val;

    pc_lo = (uint16_t)(DP16(r, 0x5Du) + 2u);
    DP16(r, 0x5Du) = pc_lo;

    r->a = val;
    r->x = pc_lo;
    /* INX; INX updates N/Z from pc_lo; C remains from CPX #$0640; SEP #$20 */
    soe_nz16(r, pc_lo);
    r->p |= SOE_M;
}

