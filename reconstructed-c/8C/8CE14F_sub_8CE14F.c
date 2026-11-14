/*
 * Routine: sub_8CE14F ($8C:E14F)
 * Script VM: transfers accumulator to X, calls anim_start_record ($90:8124), and sets Carry.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CE14F ($8CE14F) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  4 instructions (7 bytes)
 * - Compiled C ASM:   34 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      fca1998110d75ad3
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8CE14F, 0x8CE14F, RTS) {
    r->x = r->a;
    soe_nz16(r, r->x);
    soe_call_rtl(0x908124u, r);
    r->p |= SOE_C;
}

