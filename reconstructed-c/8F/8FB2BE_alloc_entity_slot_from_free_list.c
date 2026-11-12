/*
 * $8F:B2BE — alloc_entity_slot_from_free_list (RTL)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   alloc_entity_slot_from_free_list ($8FB2BE) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  39 instructions (96 bytes)
 * - Compiled C ASM:   86 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   2.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      2c630f8519788797
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(alloc_entity_slot_from_free_list, 0x8FB2BE, RTL);
void alloc_entity_slot_from_free_list_bind(soe_regs r)
{
    r->x = RAM16(0x3DE3u);
    if (r->x == 0) {
        return;
    }
    DP16(r, 0x4C) = r->x;
    RAM16(0x3DE3u) = RAM16(r->x + 0x005Eu);
    RAM16(r->x + 0x005Eu) = RAM16(0x3DE1u);
    RAM16(0x3DE1u) = r->x;
    RAM16(r->x + 0x0010u) = 0x0200u;
    r->a = 0x0200u;
    r->y = DP16(r, 0x4C);
    soe_nz16(r, r->y);
}
