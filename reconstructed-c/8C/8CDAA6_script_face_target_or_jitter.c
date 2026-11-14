/*
 * Routine: script_face_target_or_jitter ($8C:DAA6)
 * Script VM: calculates 8-way face direction towards target entity or with jitter.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_face_target_or_jitter ($8CDAA6) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  14 instructions (31 bytes)
 * - Compiled C ASM:   157 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      86525beed4f2bda0
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_face_target_or_jitter, 0x8CDAA6, RTS) {
    uint16_t y = DP16(r, 0x4Cu);
    r->y = y;
    soe_cmp16(r, y, 0x4E89u);
    if ((r->p & SOE_C) == 0u) {
        uint16_t a2a = ABSI16(r, 0x002Au, y);
        r->a = a2a;
        soe_nz16(r, a2a);
        if (a2a == 0u) {
            r->p |= SOE_C;
            return;
        }
    }
    r->a = 0x0000u;
    soe_nz16(r, 0u);
    r->y = DP16(r, 0x12u);
    soe_nz16(r, r->y);
    if (r->y == 0u) {
        soe_call_rtl(0x8FAA82u, r);
    } else {
        soe_call_rtl(0x8FAAD3u, r);
    }
    r->p |= SOE_C;
}

