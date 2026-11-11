/* Reconstructed from Secret of Evermore (USA) [$90CC1A..$90CC68].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   tile_family_animation_reset_and_init ($90CC1A) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  29 instructions (79 bytes)
 * - Compiled C ASM:   127 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      10a0a698a3830ced
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static inline void set_nz8(soe_regs r, uint8_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z)) |
                     (v == 0 ? SOE_FLAG_Z : 0) |
                     ((v & 0x80u) ? SOE_FLAG_N : 0));
}

static inline void set_nz16(soe_regs r, uint16_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z)) |
                     (v == 0 ? SOE_FLAG_Z : 0) |
                     ((v & 0x8000u) ? SOE_FLAG_N : 0));
}

SOE_BIND(tile_family_animation_reset_and_init, 0x90CC1A, RTL) {
    uint8_t saved_dbr = r->db;
    r->db = 0x7E;

    soe_wram16(0x62A5) = 0;
    soe_wram16(0x62C5) = 0;
    soe_wram16(0x62E5) = 0;
    soe_wram16(0x6305) = 0;
    soe_wram16(0x6325) = 0;
    soe_wram16(0x6345) = 0;
    soe_wram16(0x6365) = 0;
    soe_wram16(0x6385) = 0;
    soe_wram16(0x1432) = 0;
    soe_wram16(0x1278) = 0;
    soe_wram16(0x127A) = 0;
    soe_wram16(0x127C) = 0;
    soe_wram16(0x127E) = 0;
    soe_wram16(0x1282) = 0;
    soe_wram16(0x1280) = 0;

    r->a = soe_wram16(0x0A2F);
    r->x = 0x000Cu;
    soe_wram16(0x1284) = r->a;
    set_nz16(r, r->x);
    soe_call_rom(0x90CF3A, r);

    r->a = soe_wram16(0x0A79);
    r->x = 0x000Eu;
    soe_wram16(0x1286) = r->a;
    set_nz16(r, r->x);
    soe_call_rom(0x90CF3A, r);

    r->db = saved_dbr;
    set_nz8(r, saved_dbr);
}
