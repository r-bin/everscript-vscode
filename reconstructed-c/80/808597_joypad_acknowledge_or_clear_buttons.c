/*
 * $80:8597 joypad_acknowledge_or_clear_buttons (knowledge/routines/joypad_acknowledge_or_clear_buttons.md), RTL, 16-bit A/X.
 *
 * Atomically tests and clears the newly-pressed joypad bits specified in A from $7E:0104
 * via TRB $0104, leaving Z set iff none of the masked bits were set.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   joypad_acknowledge_or_clear_buttons ($808597) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  2 instructions (4 bytes)
 * - Compiled C ASM:   123 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   61.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f71065369a10a754
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(joypad_acknowledge_or_clear_buttons, 0x808597, RTL)
{
    if (r->p & SOE_M) {
        uint8_t mask = SOE_A8(r);
        uint8_t old = ABS8(r, JOYPAD1_HELD_ADDR);
        ABS8(r, JOYPAD1_HELD_ADDR) = (uint8_t)(old & (uint8_t)~mask);
        r->p = (uint8_t)((r->p & ~SOE_Z) | ((old & mask) == 0 ? SOE_Z : 0));
    } else {
        uint16_t mask = r->a;
        uint16_t old = ABS16(r, JOYPAD1_HELD_ADDR);
        ABS16(r, JOYPAD1_HELD_ADDR) = (uint16_t)(old & (uint16_t)~mask);
        r->p = (uint8_t)((r->p & ~SOE_Z) | ((old & mask) == 0 ? SOE_Z : 0));
    }
}

