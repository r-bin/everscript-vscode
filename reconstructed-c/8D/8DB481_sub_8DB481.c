/*
 * Routine: sub_8DB481 ($8D:B481)
 * Math/Decoder subsystem: decodes polynomial bit stream from $0000,X for Y iterations.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8DB481 ($8DB481) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  10 instructions (17 bytes)
 * - Compiled C ASM:   205 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   20.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      69b868b1d2764108
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8DB481, 0x8DB481, RTL) {
    uint16_t y = r->y;
    uint16_t x = r->x;
    uint16_t a = r->a;
    uint8_t p = r->p;
    uint32_t db_base = (uint32_t)r->db << 16;

    while (y != 0u) {
        y--;
        if (y == 0u) break;
        x++;
        uint8_t c = (a & 0x8000u) ? 1u : 0u;
        a = (uint16_t)(a << 1);
        uint8_t m = *(uint8_t SOE_FAR *)(db_base + x);
        uint8_t a_lo = (uint8_t)a;
        uint16_t sum = (uint16_t)(a_lo + m + c);
        uint8_t out = (uint8_t)sum;
        p = (uint8_t)((p & ~(SOE_N | SOE_V | SOE_Z | SOE_C))
            | (out & 0x80u)
            | (out == 0u ? SOE_Z : 0u)
            | (sum > 0xFFu ? SOE_C : 0u)
            | (((~(a_lo ^ m) & (a_lo ^ out) & 0x80u) != 0u) ? SOE_V : 0u));
        a = (uint16_t)((a & 0xFF00u) | out);
    }
    p &= (uint8_t)~SOE_M;
    p = (uint8_t)((p & ~SOE_N) | SOE_Z);
    r->y = y;
    r->x = x;
    r->a = a;
    r->p = p;
}

