/*
 * Routine: animation_script_store_high_pc_byte ($90:8376)
 * Copy the high byte of the animation script DP cursor ($5E) into the record's
 * saved PC field at $0001,Y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_store_high_pc_byte ($908376) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  3 instructions (6 bytes)
 * - Compiled C ASM:   123 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   41.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      9e04aa3e8c0e606f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(animation_script_store_high_pc_byte, 0x908376, RTS) {
    if ((r->p & SOE_M) != 0u) {
        uint8_t val = DP8(r, 0x5Eu);
        ABSI8(r, 0x0001u, r->y) = val;
        soe_set_a8(r, val);
        soe_nz8(r, val);
    } else {
        uint16_t val = DP16(r, 0x5Eu);
        ABSI16(r, 0x0001u, r->y) = val;
        r->a = val;
        soe_nz16(r, val);
    }
}

