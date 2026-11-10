/*
 * $80:857F snes_install_dummy_irq_vector (knowledge/routines/snes_install_dummy_irq_vector.md), RTL, 16-bit A, X, Y.
 *
 * Installs dummy IRQ vector ($80:858B) to IRQ dispatch vector $0128..$012A:
 * Sets $0129 = $8085 and $0128 = $858B, forming 24-bit pointer $80:858B (RTL).
 * Leaves A = $8085, X = $858B, N=1, Z=0.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   snes_install_dummy_irq_vector ($80857F) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  5 instructions (13 bytes)
 * - Compiled C ASM:   60 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b72298accb3651c0
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(snes_install_dummy_irq_vector, 0x80857F, RTL)
{
    SOE_AT(0x857F);
    r->x = 0x858B;
    soe_nz16(r, 0x858B);

    SOE_AT(0x8582);
    r->a = 0x8085;
    soe_nz16(r, 0x8085);

    SOE_AT(0x8585);
    ABS16(r, 0x0129) = 0x8085;

    SOE_AT(0x8588);
    ABS16(r, 0x0128) = 0x858B;
}

