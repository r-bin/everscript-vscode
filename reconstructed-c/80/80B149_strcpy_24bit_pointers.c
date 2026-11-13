/*
 * $80:B149 strcpy_24bit_pointers (knowledge/routines/strcpy_24bit_pointers.md), RTL.
 *
 * Copies a null-terminated byte string from [$26] to [$22], advancing Y until the 0x00 terminator.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   strcpy_24bit_pointers ($80B149) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (17 bytes)
 * - Compiled C ASM:   134 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      41483cbb6de4165f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(strcpy_24bit_pointers, 0x80B149, RTL)
{
    uint32_t src = SOE_DPPTR(r, 0x26);
    uint32_t dst = SOE_DPPTR(r, 0x22);
    uint16_t y = 0;
    uint8_t ch;

    for (;;) {
        ch = LONG8(src + y);
        LONG8(dst + y) = ch;
        if (ch == 0) {
            break;
        }
        y = (uint16_t)(y + 1u);
    }

    r->y = y;
    soe_set_a8(r, 0);
    soe_nz8(r, 0);
    r->p &= (uint8_t)~SOE_M;
}

