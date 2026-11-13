/* Reconstructed from Secret of Evermore (USA) [$90934B..$909378].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   vram_stream_16x16_tile_column_batch ($90934B) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  27 instructions (46 bytes)
 * - Compiled C ASM:   304 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      d160d5273556d5df
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

SOE_BIND(vram_stream_16x16_tile_column_batch, 0x90934B, RTL) {
    uint8_t saved_dbr = r->db;
    r->db = 0x80;
    uint16_t y = 0x0000u;
    uint16_t x = r->a;
    r->y = y;
    r->x = x;
    if (x != 0) {
        do {
            uint32_t ptr = (uint32_t)(DP16(r, 0x26)) | ((uint32_t)(DP8(r, 0x28)) << 16);
            r->a = soe_bus_read16(ptr + y);
            r->x = x;
            r->y = y;
            r->db = 0x80;
            set_nz16(r, r->a);
            soe_call_rom(0x8CC88C, r);

            uint16_t v2e = DP16(r, 0x2E);
            uint32_t diff = (uint32_t)v2e + 0xFF1Fu + 1u;
            if (((v2e ^ 0x00E0u) & (v2e ^ (uint16_t)diff) & 0x8000u) != 0) {
                r->p |= SOE_FLAG_V;
            } else {
                r->p &= (uint8_t)~SOE_FLAG_V;
            }
            if (diff > 0xFFFFu) {
                r->p |= SOE_FLAG_C;
            } else {
                r->p &= (uint8_t)~SOE_FLAG_C;
            }
            uint16_t a = (uint16_t)diff;
            if (a & 0x0100u) {
                uint32_t sum = (uint32_t)a + 0x0100u;
                if (((~(a ^ 0x0100u)) & (a ^ (uint16_t)sum) & 0x8000u) != 0) {
                    r->p |= SOE_FLAG_V;
                } else {
                    r->p &= (uint8_t)~SOE_FLAG_V;
                }
                if (sum > 0xFFFFu) {
                    r->p |= SOE_FLAG_C;
                } else {
                    r->p &= (uint8_t)~SOE_FLAG_C;
                }
                a = (uint16_t)sum;
            }
            DP16(r, 0x2E) = a;
            r->a = a;
            y = (uint16_t)(y + 2u);
            x = (uint16_t)(x - 1u);
        } while (x != 0);
        r->y = y;
        r->x = 0;
    }
    r->db = saved_dbr;
    set_nz8(r, saved_dbr);
}
