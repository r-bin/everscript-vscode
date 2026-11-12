/**
 * Routine: $8F:CD4D (entity_unfreeze_mobilize)
 * Bank: $8F (ROM Offset: $0FCD4D)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_unfreeze_mobilize ($8FCD4D) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  16 instructions (43 bytes)
 * - Compiled C ASM:   213 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c1d34db011ba24eb
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_unfreeze_mobilize, 0x8FCD4D, RTL);

void entity_unfreeze_mobilize_bind(soe_regs r) {
    soe_call_rtl(0x8FA8E2u, r);
    ABSI16(r, 0x0010u, r->y) &= 0xDFDEu;
    ABSI16(r, 0x0012u, r->y) &= 0xFCFFu;
    r->a = r->d;
    soe_nz16(r, r->a);
    ABSI16(r, 0x0078u, r->y) = r->a;
    soe_cmp16(r, r->y, 0x4E89u);
    if (r->p & SOE_C) {
        uint16_t child = ABSI16(r, 0x0098u, r->y);
        r->x = child;
        soe_nz16(r, child);
        if ((child & 0x8000u) == 0u) {
            DP16(r, 0x4Eu) = child;
            soe_call_rtl(0x8F9937u, r);
        }
    }
}
