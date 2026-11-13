/**
 * Routine: $90:CD5C (entity_alloc_and_assign_sprite_palette)
 * Bank: $90 (ROM Offset: $10CD5C)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_alloc_and_assign_sprite_palette ($90CD5C) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  18 instructions (36 bytes)
 * - Compiled C ASM:   199 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5a430837ceb65e53
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_alloc_and_assign_sprite_palette, 0x90CD5C, RTL);

void entity_alloc_and_assign_sprite_palette_bind(soe_regs r) {
    uint8_t saved_db = r->db;
    r->db = 0x7Eu;
    r->x = r->a;
    r->y = DP16(r, 0x4Cu);
    ABSI16(r, 0x0074u, r->y) = 0x0404u;
    r->a = r->x;
    soe_call_rtl(0x90CD80u, r);
    r->a = r->x;
    ABSI8(r, 0x000Cu, r->y) = SOE_A8(r);
    ABSI8(r, 0x0074u, r->y) = SOE_A8(r);
    ABSI8(r, 0x0075u, r->y) = SOE_A8(r);
    r->p &= (uint8_t)~(SOE_M | SOE_X);
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
