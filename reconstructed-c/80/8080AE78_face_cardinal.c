/*
 * $80:AE78 face_cardinal (knowledge/routines/face_cardinal.md), RTL, 16-bit A.
 *
 * Computes cardinal facing code (0: North, 4: East, 8: South, 12: West) from signed deltas
 * dx (DP $02) and dy (DP $04).
 * Returns facing code in A; flags N and Z from LDA #imm; leaves X, Y, D, DB preserved.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   face_cardinal ($80AE78) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  26 instructions (52 bytes)
 * - Compiled C ASM:   190 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      46ee6417a4ec60d5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(face_cardinal, 0x80AE78, RTL)
{
    uint16_t a;
    uint16_t dy = DP16(r, 0x04);
    uint16_t dx = DP16(r, 0x02);

    SOE_AT(0xAE78);
    a = dy;
    soe_nz16(r, a);
    if (a & 0x8000) {
        SOE_AT(0xAE94);
        a = dx;
        soe_nz16(r, a);
        if (a & 0x8000) {
            SOE_AT(0xAEA4);
            soe_cmp16(r, a, dy);
            if (r->p & SOE_N) {
                SOE_AT(0xAE90);
                r->a = 0x000C;
                soe_nz16(r, 0x000C);
                return;
            }
            SOE_AT(0xAEA8);
            r->a = 0x0000;
            soe_nz16(r, 0x0000);
            return;
        }

        SOE_AT(0xAE98);
        a = (uint16_t)((a - 1) ^ 0xFFFF);
        soe_nz16(r, a);
        soe_cmp16(r, a, dy);
        if (!(r->p & SOE_N)) {
            SOE_AT(0xAEA8);
            r->a = 0x0000;
            soe_nz16(r, 0x0000);
            return;
        }
        SOE_AT(0xAEA0);
        r->a = 0x0004;
        soe_nz16(r, 0x0004);
        return;
    }

    SOE_AT(0xAE7C);
    a = dx;
    soe_nz16(r, a);
    if (a & 0x8000) {
        SOE_AT(0xAE88);
        a = (uint16_t)((a - 1) ^ 0xFFFF);
        soe_nz16(r, a);
        soe_cmp16(r, a, dy);
        if (r->p & SOE_N) {
            SOE_AT(0xAE84);
            r->a = 0x0008;
            soe_nz16(r, 0x0008);
            return;
        }
        SOE_AT(0xAE90);
        r->a = 0x000C;
        soe_nz16(r, 0x000C);
        return;
    }

    SOE_AT(0xAE80);
    soe_cmp16(r, a, dy);
    if (!(r->p & SOE_N)) {
        SOE_AT(0xAEA0);
        r->a = 0x0004;
        soe_nz16(r, 0x0004);
        return;
    }
    SOE_AT(0xAE84);
    r->a = 0x0008;
    soe_nz16(r, 0x0008);
}
