/**
 * Routine: $90:8810 (entity_trigger_action_animation_sequence)
 * Bank: $90 (ROM Offset: $108810)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_trigger_action_animation_sequence ($908810) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (29 bytes)
 * - Compiled C ASM:   136 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f71ffbde08ec9eed
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_trigger_action_animation_sequence, 0x908810, RTS);

void entity_trigger_action_animation_sequence_bind(soe_regs r) {
    r->p &= (uint8_t)~(SOE_M | SOE_X);
    soe_call_rtl(0x8FB8F0u, r);
    if (!(r->p & SOE_C)) {
        r->y = DP16(r, 0x4Cu);
        soe_call_rtl(0x90828Eu, r);
        DP16(r, 0x5Du) = ABSI16(r, 0x0000u, r->y);
        uint16_t hi = ABSI16(r, 0x0001u, r->y);
        r->a = hi;
        DP16(r, 0x5Eu) = hi;
    }
    r->p |= SOE_M;
    r->y = DP16(r, 0x4Cu);
    soe_nz16(r, r->y);
}
