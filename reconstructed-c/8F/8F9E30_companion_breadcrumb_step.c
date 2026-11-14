/*
 * Routines: $8F:9E30, $8F:9E3B (companion waypoint/breadcrumb coordinate checks)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8F9E30 ($8F9E30) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (20 bytes)
 * - Compiled C ASM:   154 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   17.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0d147a2ea5931c39
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8F9E3B, 0x8F9E3B, RTS) {
    soe_bit_imm(r, r->a, 0xFFF0u);
    if ((r->a & 0xFFF0u) == 0u) {
        ABSI16(r, 0x0064u, r->y) = r->a;
    }
}

SOE_BIND(sub_8F9E30, 0x8F9E30, RTS) {
    ABSI16(r, 0x0022u, r->y) = r->a;
    uint16_t a12 = DP16(r, 0x12u);
    uint16_t a14 = DP16(r, 0x14u);
    soe_cmp16(r, a12, a14);
    if ((r->p & SOE_N) != 0u) {
        r->a = a12;
    } else {
        r->a = a14;
    }
    soe_bit_imm(r, r->a, 0xFFF0u);
    if ((r->a & 0xFFF0u) == 0u) {
        ABSI16(r, 0x0064u, r->y) = r->a;
    }
}

