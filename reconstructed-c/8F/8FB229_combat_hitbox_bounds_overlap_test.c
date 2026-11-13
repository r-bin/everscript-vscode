/* Reconstructed from Secret of Evermore (USA) [$8FB229..$8FB28C].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   combat_hitbox_bounds_overlap_test ($8FB229) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  42 instructions (100 bytes)
 * - Compiled C ASM:   213 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      87aed2195fee3780
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static inline void set_nz8(soe_regs r, uint8_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z)) |
                     (v == 0 ? SOE_FLAG_Z : 0) |
                     ((v & 0x80u) ? SOE_FLAG_N : 0));
}

SOE_BIND(combat_hitbox_bounds_overlap_test, 0x8FB229, RTL) {
    soe_wram16(0x1074) = 0x0002u;
    soe_wram16(0x1070) = 0x0002u;
    soe_wram16(0x1072) = 0x0000u;
    soe_wram16(0x3DDF) = 0x4F37u;
    soe_wram16(0x4F95) = 0x4E89u;
    soe_wram16(0x4EE7) = 0x0000u;
    soe_wram16(0x3DE1) = 0x0000u;
    soe_wram16(0x4E59) = 0x0000u;
    soe_wram16(0x4E0B) = 0x0000u;

    uint16_t a = 0x3DE5u;
    soe_wram16(0x3DE3) = a;
    uint16_t y = 0x001Du;
    uint16_t x = 0;
    do {
        x = a;
        a = (uint16_t)(a + 0x008Eu);
        soe_wram16(0x005Eu + x) = a;
        soe_wram16(0x0010u + x) = 0x0000u;
        y--;
    } while (y != 0);

    y = 0x0004u;
    a = 0x0059u;
    soe_wram16(0x3BC7) = a;
    do {
        x = a;
        a = (uint16_t)(a + 0x0059u);
        soe_wram16(0x3BC9u + x) = a;
        soe_wram16(0x3C14u + x) = 0x0000u;
        y--;
    } while (y != 0);

    x = a;
    soe_wram16(0x3BC9u + x) = 0xFFFFu;
    soe_wram16(0x3C14u + x) = 0x0000u;

    r->a = 0xFFFFu;
    r->x = x;
    r->y = 0x0000u;
    r->p = (uint8_t)(r->p & ~(SOE_FLAG_C | SOE_FLAG_V));
    set_nz8(r, r->db);
}
