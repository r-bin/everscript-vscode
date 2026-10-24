/*
 * $8F:A946 elevation_plane_transition_gate (knowledge/rom/8fa946.md), RTL, 16-bit A.
 *
 * In: A = a metatile collision word, DP $44 = the entity's plane word. C = 1 (SEC) unless refused.
 *  - word bits $2040: as update_entity_plane's tail ($8F:A91F): bit 6 clears bit 6 of $44, else
 *    $44 = (word & $30) | $40;
 *  - word ^ $44 has bit 6 (only one of them plane-transparent): $44 = word & $30;
 *  - else the planes must match: (word ^ $44) & $30 != 0 refuses with C = 0, A = that difference.
 * Leaves A, N Z as the last AND/ORA/LDA/TRB leaves them; V as entered.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   elevation_plane_transition_gate ($8FA946) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (49 bytes)
 * - Compiled C ASM:   153 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      90632aa3753a80b8
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(elevation_plane_transition_gate, 0x8FA946, RTL)
{
    uint16_t a = r->a;
    uint16_t plane = DP16(r, 0x44);

    soe_carry(r, true);
    if (a & 0x2040) {
        if (a & 0x0040) {                                    /* $A92D */
            a = 0x0040;
            soe_nz16(r, a);
            DP16(r, 0x44) = (uint16_t)(plane & ~a);
            r->p = (uint8_t)((r->p & ~SOE_Z) | ((plane & a) == 0 ? SOE_Z : 0));
        } else {
            a = (uint16_t)((a & 0x0030) | 0x0040);
            soe_nz16(r, a);
            DP16(r, 0x44) = a;
        }
    } else if ((a ^ plane) & 0x0040) {                       /* $A959: EOR $44 again restores the word */
        a &= 0x0030;
        soe_nz16(r, a);
        DP16(r, 0x44) = a;
    } else {
        a = (uint16_t)((a ^ plane) & 0x0030);
        soe_nz16(r, a);
        if (a) soe_carry(r, false);
    }
    r->a = a;
}