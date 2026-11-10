/*
 * $90:D7CB alchemy_projectile_slot_array_clear (knowledge/routines/alchemy_projectile_slot_array_clear.md), RTL, 16-bit A, X, Y.
 *
 * Clears projectile manager active word $0F34 and the 4 projectile slot head words at $0ECA,X (X=$51, $36, $1B, $00).
 * Leaves A = X = $FFE5, N=1, Z=0, C=0.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   alchemy_projectile_slot_array_clear ($90D7CB) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (18 bytes)
 * - Compiled C ASM:   83 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      842e4226c8451047
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(alchemy_projectile_slot_array_clear, 0x90D7CB, RTL)
{
    uint16_t x;
    uint16_t a;

    SOE_AT(0xD7CB);
    RAM16(0x0F34) = 0;

    SOE_AT(0xD7CE);
    x = 0x0051;
    r->x = x;
    soe_nz16(r, x);

    do {
        SOE_AT(0xD7D1);
        RAM16(0x0ECA + x) = 0;

        SOE_AT(0xD7D4);
        r->a = x;
        soe_carry(r, true);
        a = soe_sbc16(r, x, 0x001B);
        x = a;
        r->x = x;
        r->a = a;
        soe_nz16(r, x);
    } while (!(r->p & SOE_N));
}

