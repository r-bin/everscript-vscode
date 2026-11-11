/*
 * $8C:EC8E script_entity_operand (knowledge/routines/script_entity_operand.md), RTL, 16-bit A, X, Y.
 *
 * Evaluates a script expression via $8C:EA43, stores the resulting entity pointer into DP $4C,
 * and transfers it to Y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_entity_operand ($8CEC8E) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  4 instructions (8 bytes)
 * - Compiled C ASM:   38 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c523c4af08bd9459
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(script_entity_operand, 0x8CEC8E, RTL)
{
    SOE_AT(0xEC8E);
    soe_call_rtl(0x8CEA43, r);
    DP16(r, 0x4C) = r->a;
    r->y = r->a;
    soe_nz16(r, r->y);
}
