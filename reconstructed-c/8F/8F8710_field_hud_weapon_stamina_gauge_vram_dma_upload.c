/* Reconstructed from Secret of Evermore (USA) [$8F8710..$8F87FD].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   field_hud_weapon_stamina_gauge_vram_dma_upload ($8F8710) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  90 instructions (238 bytes)
 * - Compiled C ASM:   226 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   2.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0bc97dce60e623ff
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static inline void set_nz16(soe_regs r, uint16_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z)) |
                     (v == 0 ? SOE_FLAG_Z : 0) |
                     ((v & 0x8000u) ? SOE_FLAG_N : 0));
}

SOE_BIND(field_hud_weapon_stamina_gauge_vram_dma_upload, 0x8F8710, RTL) {
    DP16(r, 0x26) = 0x3704u;
    DP16(r, 0x28) = 0x00C4u;
    DP16(r, 0x2E) = 0x1F48u;
    r->a = 0x1F48u;
    r->x = 0x0160u;
    set_nz16(r, r->x);
    soe_call_rom(0x808650, r);

    DP16(r, 0x26) = 0x3864u;
    DP16(r, 0x28) = 0x00C4u;
    DP16(r, 0x2E) = 0x0008u;
    r->a = 0x0008u;
    r->x = 0x0008u;
    set_nz16(r, r->x);
    soe_call_rom(0x8085FA, r);

    DP16(r, 0x26) = 0x386Cu;
    DP16(r, 0x28) = 0x00C4u;
    DP16(r, 0x2E) = 0x000Cu;
    r->a = 0x000Cu;
    r->x = 0x0008u;
    set_nz16(r, r->x);
    soe_call_rom(0x8085FA, r);

    soe_wram16(0x051F) = 0x0019u;
    soe_wram16(0x0563) = 0x0019u;
    soe_wram16(0x051D) = 0x0003u;
    soe_wram16(0x0561) = 0x0013u;
    soe_wram16(0x0521) = 0x3A3Eu;
    soe_wram16(0x0565) = 0x3A7Eu;
    soe_wram16(0x0523) = 0x1F00u;
    soe_wram16(0x0567) = 0x1F20u;

    soe_wram16(0x0545) = 0x2BE9u;
    soe_wram16(0x0589) = 0x2BE9u;
    soe_wram16(0x0547) = 0x2BE9u;
    soe_wram16(0x058B) = 0x2BE9u;
    soe_wram16(0x0549) = 0x2BE9u;
    soe_wram16(0x058D) = 0x2BE9u;
    soe_wram16(0x054B) = 0x2BE9u;
    soe_wram16(0x058F) = 0x2BE9u;
    soe_wram16(0x054D) = 0x2BE9u;
    soe_wram16(0x0591) = 0x2BE9u;
    soe_wram16(0x054F) = 0x2BE9u;
    soe_wram16(0x0593) = 0x2BE9u;
    soe_wram16(0x0551) = 0x2BE9u;
    soe_wram16(0x0595) = 0x2BE9u;

    soe_wram16(0x052D) = 0x2FE0u;
    soe_wram16(0x052F) = 0x2FE1u;
    soe_wram16(0x0531) = 0x2FE2u;
    soe_wram16(0x0533) = 0x2FE3u;

    soe_wram16(0x052B) = 0x6FE0u;
    soe_wram16(0x0529) = 0x6FE1u;
    soe_wram16(0x0527) = 0x6FE2u;
    soe_wram16(0x0525) = 0x6FE3u;

    soe_wram16(0x0571) = 0x2FE4u;
    soe_wram16(0x0573) = 0x2FE5u;
    soe_wram16(0x0575) = 0x2FE6u;
    soe_wram16(0x0577) = 0x2FE7u;

    soe_wram16(0x056F) = 0x6FE4u;
    soe_wram16(0x056D) = 0x6FE5u;
    soe_wram16(0x056B) = 0x6FE6u;
    soe_wram16(0x0569) = 0x6FE7u;

    soe_wram16(0x0B29) = 0x0001u;
    r->a = 0x0001u;
    set_nz16(r, r->a);
}
