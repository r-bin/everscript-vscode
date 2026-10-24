/*
 * $8F:A97D elevation_manhattan_distance_eval (knowledge/rom/8fa97d.md), RTS, 8-bit accumulator.
 *
 * Signed bytes dx = DP $12, dy = DP $13. Signs differ: |dx + dy|; signs match: |dx - dy|, in 8 bits
 * (the sum or difference wraps; a result of $80 stays $80). Leaves A low byte = the result; C and V
 * from the ADC/SBC, N and Z from the last instruction that set them.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   elevation_manhattan_distance_eval ($8FA97D) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  17 instructions (28 bytes)
 * - Compiled C ASM:   146 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      cfe1f0d7fb08f065
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(elevation_manhattan_distance_eval, 0x8FA97D, RTS)
{
    uint8_t dx = DP8(r, 0x12), dy = DP8(r, 0x13);
    uint8_t a;

    if ((dx ^ dy) & 0x80) {
        soe_carry(r, false);
        a = soe_adc8(r, dx, dy);
    } else {
        soe_carry(r, true);
        a = soe_sbc8(r, dx, dy);
    }
    if (a & 0x80) {                     /* EOR #$FF / INC A */
        a = (uint8_t)(0 - a);
        soe_nz8(r, a);
    }
    soe_set_a8(r, a);
}