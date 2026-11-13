/*
 * $8F:98B5 — multipart_child_get_or_create_secondary (RTL)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   multipart_child_get_or_create_secondary ($8F98B5) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  35 instructions (73 bytes)
 * - Compiled C ASM:   254 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3924b68768ec0e56
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(multipart_child_get_or_create_secondary, 0x8F98B5, RTL);
void multipart_child_get_or_create_secondary_bind(soe_regs r)
{
    r->y = DP16(r, 0x4C);
    r->x = RAM16(r->y + 0x006Cu);
    if ((r->x & 0x8000u) == 0) {
        DP16(r, 0x4E) = r->x;
        soe_nz16(r, r->x);
        r->p |= SOE_C;
        return;
    }

    r->x = RAM16(0x3BC7u);
    if ((r->x & 0x8000u) == 0) {
        RAM16(0x3BC7u) = RAM16(0x3BC9u + r->x);
    } else {
        r->x = 0;
        for (;;) {
            r->y = RAM16(0x3C14u + r->x);
            if (RAM16(r->y + 0x006Au) == 0) {
                RAM16(r->y + 0x006Au) = 0xFFFFu;
                r->y = DP16(r, 0x4C);
                break;
            }
            r->x = (uint16_t)(r->x + 0x0059u);
            if (r->x == 0x0216u) {
                r->a = 0x0216u;
                soe_nz16(r, 0x0216u);
                r->p &= (uint8_t)~SOE_C;
                return;
            }
        }
    }

    RAM16(0x3C14u + r->x) = r->y;
    DP16(r, 0x4E) = r->x;
    RAM16(r->y + 0x006Cu) = r->x;
    RAM16(0x3C12u + r->x) = 0;
    r->a = r->x;
    soe_call_rtl(0x8F9937u, r);
    r->p |= SOE_C;
}
