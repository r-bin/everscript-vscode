/*
 * $8F:AF48 — probe_metatile_collision (RTL)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   probe_metatile_collision ($8FAF48) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  41 instructions (102 bytes)
 * - Compiled C ASM:   329 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0c1be29c326a7c6e
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(probe_metatile_collision, 0x8FAF48, RTL);
void probe_metatile_collision_bind(soe_regs r)
{
    DP16(r, 0x44) = RAM16(r->y + 0x0018u);
    uint16_t flags = RAM16(r->y + 0x0010u);
    r->a = flags;

    if ((flags & 0x0800u) != 0) {
        r->x = DP16(r, 0x46);
        r->y = DP16(r, 0x48);
        soe_call_rtl(0x909815u, r);
        soe_call_rtl(0x8FA914u, r);
        r->y = DP16(r, 0x4C);
        soe_nz16(r, r->y);
        r->p |= SOE_C;
        return;
    }

    if ((flags & 0x0480u) == 0) {
        r->x = DP16(r, 0x46);
        r->y = DP16(r, 0x48);
        soe_call_rtl(0x909815u, r);
        soe_call_rtl(0x8FA946u, r);
        if ((r->p & SOE_C) != 0) {
            soe_call_rtl(0x909561u, r);
            if ((r->p & SOE_C) != 0) {
                soe_call_rtl(0x8FB46Du, r);
            }
        }
        r->y = DP16(r, 0x4C);
        soe_nz16(r, r->y);
        return;
    }

    if ((flags & 0x0400u) == 0) {
        r->x = DP16(r, 0x46);
        r->y = DP16(r, 0x48);
        soe_call_rtl(0x909815u, r);
        soe_call_rtl(0x8FA946u, r);
        if ((r->p & SOE_C) != 0) {
            soe_call_rtl(0x909561u, r);
        }
        r->y = DP16(r, 0x4C);
        soe_nz16(r, r->y);
        return;
    }

    soe_call_rtl(0x909545u, r);
    if ((r->p & SOE_C) != 0) {
        r->x = DP16(r, 0x46);
        r->y = DP16(r, 0x48);
        soe_call_rtl(0x909815u, r);
        soe_call_rtl(0x8FA914u, r);
        r->y = DP16(r, 0x4C);
        soe_nz16(r, r->y);
        r->p |= SOE_C;
        return;
    }

    r->y = DP16(r, 0x4C);
    soe_nz16(r, r->y);
}
