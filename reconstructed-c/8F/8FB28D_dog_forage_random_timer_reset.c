/*
 * $8F:B28D dog_forage_random_timer_reset (knowledge/routines/dog_forage_random_timer_reset.md), RTL, 16-bit A, X, Y.
 *
 * Resets companion dog foraging cooldown timer:
 * 1. Calls RNG ($80:859B).
 * 2. Masks random word with $07FF (0..2047).
 * 3. Adds $04B0 (1200) with carry.
 * 4. Stores sum into $1464.
 * Leaves A = sum, flags from ADC.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   dog_forage_random_timer_reset ($8FB28D) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  5 instructions (14 bytes)
 * - Compiled C ASM:   50 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      75b194f8e745bbdd
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(dog_forage_random_timer_reset, 0x8FB28D, RTL)
{
    uint16_t a;

    SOE_AT(0xB28D);
    soe_call_rtl(0x80859BUL, r);

    SOE_AT(0xB291);
    a = (uint16_t)(r->a & 0x07FF);

    SOE_AT(0xB294);
    a = soe_adc16(r, a, 0x04B0);
    r->a = a;

    SOE_AT(0xB297);
    ABS16(r, 0x1464) = a;
}

