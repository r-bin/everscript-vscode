/*
 * $90:DC21 projectile_entity_slot_link_init (knowledge/routines/projectile_entity_slot_link_init.md), RTL, 16-bit A, X, Y.
 *
 * Initializes projectile entity slot structures $6387..$64E7:
 * Sets $0EC2 = $6387, steps in increments of 44 bytes ($2C), clearing slot field +$10,X.
 * Leaves A = $64E7, X = $64BB, N=0, Z=1, C=1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_entity_slot_link_init ($90DC21) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (20 bytes)
 * - Compiled C ASM:   142 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   15.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8b7af28d007acad5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(projectile_entity_slot_link_init, 0x90DC21, RTL)
{
    uint16_t a;
    uint16_t x;

    SOE_AT(0xDC21);
    a = 0x6387;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xDC24);
    ABS16(r, 0x0EC2) = a;

    do {
        SOE_AT(0xDC27);
        x = a;
        r->x = x;
        soe_nz16(r, x);

        SOE_AT(0xDC28);
        ABS16(r, (uint16_t)(x + 0x0010)) = 0;

        SOE_AT(0xDC2B);
        soe_carry(r, false);

        SOE_AT(0xDC2C);
        a = soe_adc16(r, a, 0x002C);
        r->a = a;

        SOE_AT(0xDC2F);
        soe_cmp16(r, a, 0x64E7);
    } while (!(r->p & SOE_C));
}

