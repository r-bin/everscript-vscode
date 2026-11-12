/**
 * Routine: $8F:98A4 (multipart_child_create_with_flag_1000)
 * Bank: $8F (ROM Offset: $0F98A4)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   multipart_child_create_with_flag_1000 ($8F98A4) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  7 instructions (17 bytes)
 * - Compiled C ASM:   92 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1917c2f4f6677779
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(multipart_child_create_with_flag_1000, 0x8F98A4, RTL);

void multipart_child_create_with_flag_1000_bind(soe_regs r) {
    soe_call_rtl(0x8F9877u, r);
    if (r->p & SOE_N) {
        return;
    }
    uint16_t flags = (uint16_t)(ABSI16(r, 0x3C12u, r->x) | 0x1000u);
    ABSI16(r, 0x3C12u, r->x) = flags;
    r->a = r->x;
    soe_nz16(r, r->a);
}
