/*
 * $8F:CD78 entity_freeze_immobilize (knowledge/routines/entity_freeze_immobilize.md), RTL, 16-bit A, X, Y.
 *
 * Loads entity pointer from DP $4C into Y, frees its primary multipart child via $8F:98FE,
 * and sets the immobilized bit ($0020) in entity flags +$10,Y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_freeze_immobilize ($8FCD78) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (16 bytes)
 * - Compiled C ASM:   95 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   15.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8009929923812173
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

void multipart_child_free_primary_bind(soe_regs r);

SOE_BIND(entity_freeze_immobilize, 0x8FCD78, RTL)
{
    SOE_AT(0xCD78);
    r->y = DP16(r, 0x4C);
    soe_nz16(r, r->y);
    multipart_child_free_primary_bind(r);
    r->a = (uint16_t)(ABSI16(r, 0x0010, r->y) | 0x0020);
    ABSI16(r, 0x0010, r->y) = r->a;
    soe_nz16(r, r->a);
}
