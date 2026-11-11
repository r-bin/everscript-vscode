/* Reconstructed from Secret of Evermore (USA) [$90A0B2..$90A140].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   room_canopy_terrain_tilemap_row_stride_index ($90A0B2) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  77 instructions (143 bytes)
 * - Compiled C ASM:   415 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c95afc3000050e93
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

SOE_BIND(room_canopy_terrain_tilemap_row_stride_index, 0x90A0B2, RTL) {
    uint8_t saved_dbr = r->db;
    r->db = 0x7E;
    DP16(r, 0x26) = 0x0000u;
    DP16(r, 0x28) = 0xFFFFu;

    uint16_t y = DP16(r, 0x2E) >> 5;
    soe_wram16(0x106E) = (y & 0x0007u) | ((y >> 1) & 0xFFF8u);

    uint16_t v14 = (uint16_t)(soe_wram16(0x106C) << 1);
    DP16(r, 0x14) = v14;

    uint16_t x = 0x0000u;
    uint32_t base_a7 = (uint32_t)(DP16(r, 0xA7)) | ((uint32_t)(DP8(r, 0xA9)) << 16);
    while (x != v14) {
        y = (uint16_t)(x << 1);
        uint16_t a = soe_bus_read16(base_a7 + y) & 0x00FFu;
        if (a != DP16(r, 0x28)) {
            DP16(r, 0x28) = a;
            uint16_t y26 = DP16(r, 0x26);
            soe_wram16(0x507Du + y26) = y;
            DP16(r, 0x26) = (uint16_t)(y26 + 2u);
        }
        y = x >> 1;
        soe_wram8(0x5018u + y) = 0x00u;
        soe_wram8(0x4FE6u + y) = 0x00u;
        soe_wram8(0x504Au + y) = 0xFFu;

        y = (uint16_t)((x + 1u) << 1);
        y = soe_bus_read16(base_a7 + y);
        y = (uint16_t)(y + 1u);
        uint16_t val = soe_bus_read16(base_a7 + y);
        soe_bus_write16(0x7FA000u + x, val);
        x = (uint16_t)(x + 2u);
    }

    uint16_t y_end = DP16(r, 0x26);
    soe_wram16(0x507Du + y_end) = 0xFFFFu;
    x = soe_wram16(0x106C);
    soe_wram8(0x504Au + x) = 0xFFu;
    r->p &= (uint8_t)~(SOE_FLAG_M | SOE_FLAG_X);

    DP16(r, 0x26) = 0xA000u;
    DP16(r, 0x28) = 0x007Fu;
    r->x = x;
    r->y = y_end;
    r->a = x;
    set_nz16(r, r->a);
    r->p |= SOE_FLAG_C;
    soe_call_rom(0x90934B, r);

    r->db = saved_dbr;
    set_nz8(r, saved_dbr);
}
