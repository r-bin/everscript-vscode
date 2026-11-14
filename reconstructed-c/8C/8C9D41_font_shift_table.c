/*
 * Routines: $8C:9D41, $8C:9D46, $8C:9D4C (font glyph shift jump table targets)
 * Shifts accumulator left by 4, 5, or 6 bits, updating Carry, N, and Z.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   font_shift_left_6 ($8C9D4C) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  7 instructions (7 bytes)
 * - Compiled C ASM:   3 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   0.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      99825147c8fcdc5d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static inline void font_asl_step(soe_regs r, int count) {
    if ((r->p & SOE_M) != 0u) {
        uint8_t a = SOE_A8(r);
        for (int i = 0; i < count; i++) {
            soe_carry(r, (a & 0x80u) != 0u);
            a = (uint8_t)(a << 1);
        }
        soe_set_a8(r, a);
        soe_nz8(r, a);
    } else {
        uint16_t a = r->a;
        for (int i = 0; i < count; i++) {
            soe_carry(r, (a & 0x8000u) != 0u);
            a = (uint16_t)(a << 1);
        }
        r->a = a;
        soe_nz16(r, a);
    }
}

SOE_BIND(font_shift_left_4, 0x8C9D41, RTS) {
    font_asl_step(r, 4);
}

SOE_BIND(font_shift_left_5, 0x8C9D46, RTS) {
    font_asl_step(r, 5);
}

SOE_BIND(font_shift_left_6, 0x8C9D4C, RTS) {
    font_asl_step(r, 6);
}

