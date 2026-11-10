/*
 * $91:CC15 alchemy_inventory_slots_clear (knowledge/routines/alchemy_inventory_slots_clear.md), RTL, 16-bit A, X, Y.
 *
 * Resets 9 alchemy formula ingredient slots $0AD2..$0ADA to $FF:
 * Loops X from 8 down to 0, writing $FF into $0AD2,X in 8-bit accumulator mode.
 * Leaves A = (A & 0xFF00) | 0xFF, X = $FFFF, N=1, Z=0.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   alchemy_inventory_slots_clear ($91CC15) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  8 instructions (16 bytes)
 * - Compiled C ASM:   102 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      75f6afac8ac69a21
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(alchemy_inventory_slots_clear, 0x91CC15, RTL)
{
    uint16_t x;

    SOE_AT(0xCC15);
    x = 0x0008;
    r->x = x;
    soe_nz16(r, x);

    SOE_AT(0xCC18);
    r->p |= SOE_M;

    SOE_AT(0xCC1A);
    soe_set_a8(r, 0xFF);
    soe_nz8(r, 0xFF);

    do {
        SOE_AT(0xCC1C);
        ABS8(r, (uint16_t)(0x0AD2 + x)) = 0xFF;

        SOE_AT(0xCC1F);
        x--;
        r->x = x;
        soe_nz16(r, x);
    } while (!(r->p & SOE_N));

    SOE_AT(0xCC22);
    r->p &= ~SOE_M;
}

