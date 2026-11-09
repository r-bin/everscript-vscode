/*
 * $91:9795 alchemy_all_slots_clear (knowledge/routines/alchemy_all_slots_clear.md), RTL, 16-bit A and X.
 *
 * Resets all 8 animation alchemy slots ($7E:3364..$7E:3564, stride $40) and all 8 projectile alchemy
 * slots ($7E:3564..$7E:3914, stride $76) by zeroing active state word +$14,X.
 * Leaves A = $3914, X = $389E, C set, N Z from the restored DB (PLB).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   alchemy_all_slots_clear ($919795) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  20 instructions (40 bytes)
 * - Compiled C ASM:   152 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      087c2c3713e063b7
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(alchemy_all_slots_clear, 0x919795, RTL)
{
    uint16_t a;
    uint16_t x;

    SOE_AT(0x9795);
    a = 0x3364;
    do {
        SOE_AT(0x979E);
        x = a;
        RAM16(x + 0x14) = 0;
        soe_carry(r, false);
        a = soe_adc16(r, a, 0x0040);
        soe_cmp16(r, a, 0x3564);
    } while (a != 0x3564);

    SOE_AT(0x97AB);
    a = 0x3564;
    do {
        SOE_AT(0x97AE);
        x = a;
        RAM16(x + 0x14) = 0;
        soe_carry(r, false);
        a = soe_adc16(r, a, 0x0076);
        soe_cmp16(r, a, 0x3914);
    } while (a != 0x3914);

    soe_nz8(r, r->db);                                       /* PLB */
    r->a = a;
    r->x = x;
}
