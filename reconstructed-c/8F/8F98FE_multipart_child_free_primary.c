/*
 * $8F:98FE multipart_child_free_primary (knowledge/rom/8f98fe.md), RTL, 16-bit A and X.
 *
 * In: Y = an entity record (DB-relative). X = its child slot (rec + $6A); negative: none, return.
 * Else the slot goes back to the free list headed at $3BC7 (slot + $3BC9 = old head, head = slot),
 * slot + $3C14 = 0, and rec + $6A = $FFFF. Leaves X = the slot, A = $FFFF (or as entered), N Z from
 * the last load.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   multipart_child_free_primary ($8F98FE) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (24 bytes)
 * - Compiled C ASM:   159 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   17.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      803e5068e73ea946
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(multipart_child_free_primary, 0x8F98FE, RTL)
{
    uint16_t x = ABSI16(r, ENTITY_RECORD_CHILD_SLOT_OFF, r->y);

    r->x = x;
    soe_nz16(r, x);
    if (x & 0x8000) return;
    ABSI16(r, 0x3C14, x) = 0;
    ABSI16(r, 0x3BC9, x) = ABS16(r, 0x3BC7);
    ABS16(r, 0x3BC7) = x;
    r->a = 0xFFFF;
    soe_nz16(r, 0xFFFF);
    ABSI16(r, ENTITY_RECORD_CHILD_SLOT_OFF, r->y) = 0xFFFF;
}