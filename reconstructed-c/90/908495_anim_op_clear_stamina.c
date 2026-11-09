/*
 * $90:8495 anim_op_clear_stamina (knowledge/routines/anim_op_clear_stamina.md), RTS, 8-bit A on entry and exit.
 *
 * Animation command 4E: resets entity stamina (+$2E = 0) and clears bit 9 ($0200) of
 * closed states (+$14) for the active entity record in Y.
 * Leaves X = entity record offset, A = masked +$14 word, N Z from the AND, 8-bit A (M=1).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   anim_op_clear_stamina ($908495) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  8 instructions (18 bytes)
 * - Compiled C ASM:   96 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      853c711bae28fa1e
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(anim_op_clear_stamina, 0x908495, RTS)
{
    uint16_t x = r->y;
    uint16_t closed_states;

    SOE_AT(0x8495);
    r->x = x;
    ABSI16(r, ENTITY_RECORD_STAMINA_OFF, x) = 0;
    closed_states = (uint16_t)(ABSI16(r, ENTITY_RECORD_CLOSED_STATES_OFF, x) & 0xFDFF);
    ABSI16(r, ENTITY_RECORD_CLOSED_STATES_OFF, x) = closed_states;
    r->a = closed_states;
    soe_nz16(r, closed_states);
    r->p |= SOE_M;
}
