/*
 * $90:8485 anim_op_mode (knowledge/rom/908485.md), RTS, 8-bit A on entry and exit.
 *
 * rec + $16 (Y, DB-relative) = the word at the animation script pointer DP $5D (24-bit), which
 * steps by 2. Leaves A = the word, X = the new pointer, N Z from the INX.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   anim_op_mode ($908485) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (16 bytes)
 * - Compiled C ASM:   108 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c7ba5463b2d21d49
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(anim_op_mode, 0x908485, RTS)
{
    uint16_t word = LONG16(SOE_DPPTR(r, 0x5D));
    uint16_t x = (uint16_t)(DP16(r, 0x5D) + 2);

    ABSI16(r, ENTITY_RECORD_MODE_OFF, r->y) = word;
    DP16(r, 0x5D) = x;
    r->a = word;
    r->x = x;
    soe_nz16(r, x);
    r->p |= SOE_M;
}