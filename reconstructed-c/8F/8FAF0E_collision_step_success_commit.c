/*
 * $8F:AF0E collision_step_success_commit (knowledge/rom/8faf0e.md), RTL, 16-bit A.
 *
 * Sets bit 0 of the word at Y + $12 (DB-relative entity record). Leaves A = the new word, N Z from it.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   collision_step_success_commit ($8FAF0E) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  4 instructions (10 bytes)
 * - Compiled C ASM:   62 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   15.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3928ea6f20438163
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(collision_step_success_commit, 0x8FAF0E, RTL)
{
    uint16_t a = (uint16_t)(ABSI16(r, ENTITY_RECORD_STATE_OFF, r->y) | 0x0001);

    ABSI16(r, ENTITY_RECORD_STATE_OFF, r->y) = a;
    r->a = a;
    soe_nz16(r, a);
}