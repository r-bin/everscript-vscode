/* Reconstructed from Secret of Evermore (USA) [$90CD80..$90CDD9].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sprite_palette_allocator ($90CD80) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  105 instructions (254 bytes)
 * - Compiled C ASM:   187 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   1.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      116ee66a4206aba5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static inline void set_nz16(soe_regs r, uint16_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z)) |
                     (v == 0 ? SOE_FLAG_Z : 0) |
                     ((v & 0x8000u) ? SOE_FLAG_N : 0));
}

static inline void cmp16(soe_regs r, uint16_t a, uint16_t b) {
    uint16_t d = (uint16_t)(a - b);
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z | SOE_FLAG_C)) |
                     (a >= b ? SOE_FLAG_C : 0) |
                     (d == 0 ? SOE_FLAG_Z : 0) |
                     ((d & 0x8000u) ? SOE_FLAG_N : 0));
}

SOE_BIND(sprite_palette_allocator, 0x90CD80, RTL)
{
    uint16_t v;

    r->x = 0x0008u;
    v = soe_wram16(0x1278u + 0x0008u);
    cmp16(r, r->a, v);
    if (r->a == v) return;

    r->x = 0x000Au;
    v = soe_wram16(0x1278u + 0x000Au);
    cmp16(r, r->a, v);
    if (r->a == v) return;

    r->x = 0x0000u;
    v = soe_wram16(0x1278u + 0x0000u);
    cmp16(r, r->a, v);
    if (r->a == v) return;

    r->x = 0x0002u;
    v = soe_wram16(0x1278u + 0x0002u);
    cmp16(r, r->a, v);
    if (r->a == v) return;

    r->x = 0x0004u;
    v = soe_wram16(0x1278u + 0x0004u);
    cmp16(r, r->a, v);
    if (r->a == v) return;

    uint16_t saved_y = r->y;
    uint16_t saved_a = r->a;
    soe_call_rom(0x90CE20, r);

    if (soe_wram16(0x1280) == 0) {
        r->x = 0x0008u;
    } else if (soe_wram16(0x1282) == 0) {
        r->x = 0x000Au;
    } else if (soe_wram16(0x1278) == 0) {
        r->x = 0x0000u;
    } else if (soe_wram16(0x127A) == 0) {
        r->x = 0x0002u;
    } else {
        r->x = 0x0002u;
        r->a = saved_a;
        r->y = saved_y;
        set_nz16(r, r->y);
        soe_call_rom(0x90CE92, r);
        return;
    }

    r->a = saved_a;
    r->y = saved_y;
    set_nz16(r, r->y);
    soe_wram16(0x1278u + r->x) = r->a;
    soe_call_rom(0x90CF3A, r);
}
