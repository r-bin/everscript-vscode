/*
 * $8F:AB6E calc_8way_direction_with_random_jitter (knowledge/routines/calc_8way_direction_with_random_jitter.md), RTL, 16-bit A, X, Y.
 *
 * Target directional heading calculator with random angular jitter:
 * 1. Rolls RNG ($80:859B) & $003E -> table index X.
 * 2. dx ($12) = target_x ($46) - entity_x (+$1A,y).
 * 3. dy ($14) = target_y ($48) - entity_y (+$1C,y).
 * 4. Calls calc_8way_direction_from_coordinate_deltas ($8F:AA05).
 * 5. Adds jitter offset from ROM table $8F:DB0C,x (with carry from AA05).
 * 6. Masks with $000E (0..14 even).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   calc_8way_direction_with_random_jitter ($8FAB6E) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  15 instructions (36 bytes)
 * - Compiled C ASM:   206 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8e4938bef9d68903
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(calc_8way_direction_with_random_jitter, 0x8FAB6E, RTL)
{
    uint16_t a;

    SOE_AT(0xAB6E);
    soe_call_rtl(0x80859BUL, r);
    r->x = (uint16_t)(r->a & 0x003E);
    soe_nz16(r, r->x);

    SOE_AT(0xAB76);
    soe_carry(r, true);
    a = soe_sbc16(r, DP16(r, 0x46), ABSI16(r, 0x001A, r->y));
    DP16(r, 0x12) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xAB7E);
    soe_carry(r, true);
    a = soe_sbc16(r, DP16(r, 0x48), ABSI16(r, 0x001C, r->y));
    DP16(r, 0x14) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xAB86);
    soe_call_rtl(0x8FAA05UL, r);

    SOE_AT(0xAB8A);
    a = soe_adc16(r, r->a, ROM16(0x8FDB0CUL + r->x));

    SOE_AT(0xAB8E);
    a = (uint16_t)(a & 0x000E);
    r->a = a;
    soe_nz16(r, a);
}
