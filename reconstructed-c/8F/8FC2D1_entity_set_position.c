/* Reconstructed from Secret of Evermore (USA) [$8FC2D1..$8FC376].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_set_position ($8FC2D1) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  72 instructions (166 bytes)
 * - Compiled C ASM:   612 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1e0fc37468242a30
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

SOE_BIND(entity_set_position, 0x8FC2D1, RTL) {
    uint16_t y = DP16(r, 0x4C);
    r->y = y;
    DP16(r, 0x44) = soe_wram16(y + 0x18u);
    r->a = DP16(r, 0x44);
    r->x = DP16(r, 0x46);
    r->y = DP16(r, 0x48);
    set_nz16(r, r->y);
    soe_call_rom(0x909815, r);
    soe_call_rom(0x8FA914, r);

    y = DP16(r, 0x4C);
    r->y = y;
    soe_wram16(y + 0x18u) = DP16(r, 0x44);
    uint16_t v46 = DP16(r, 0x46);
    soe_wram16(y + 0x1Au) = v46;
    uint16_t tx = (v46 >> 4) & 0x00FFu;
    DP16(r, 0x12) = tx;

    uint16_t w = soe_wram16(0x08EE);
    uint16_t v48 = DP16(r, 0x48);
    soe_wram16(y + 0x1Cu) = v48;
    uint16_t ty_hi = (uint16_t)(v48 << 4) & 0xFF00u;

    if (tx >= w) {
        if ((v48 << 3) & 0x8000u) {
            r->p |= SOE_FLAG_C;
        } else {
            r->p &= (uint8_t)~SOE_FLAG_C;
        }
        uint16_t pos = ty_hi | tx;
        soe_wram16(y + 0x62u) = pos;
        r->a = pos;
    } else {
        uint16_t h_hi = soe_wram16(0x08EF);
        if (ty_hi >= h_hi) {
            r->p |= SOE_FLAG_C;
            uint16_t pos = ty_hi | tx;
            soe_wram16(y + 0x62u) = pos;
            r->a = pos;
        } else {
            uint16_t pos = ty_hi | tx;
            soe_wram16(y + 0x62u) = pos;
            uint16_t mul_in = (pos & 0xFF00u) | w;
            soe_bus_write16(0x004202, mul_in);
            uint16_t prod = soe_bus_read16(0x004216);
            uint32_t sum = (uint32_t)tx + (uint32_t)prod;
            if (((~(tx ^ prod)) & (tx ^ (uint16_t)sum) & 0x8000u) != 0) {
                r->p |= SOE_FLAG_V;
            } else {
                r->p &= (uint8_t)~SOE_FLAG_V;
            }
            if (sum & 0x8000u) {
                r->p |= SOE_FLAG_C;
            } else {
                r->p &= (uint8_t)~SOE_FLAG_C;
            }
            uint16_t idx = (uint16_t)(sum << 1);
            soe_wram16(y + 0x3Au) = idx;
            uint16_t x1 = soe_bus_read16(0x7F0000u + idx);
            uint16_t val = soe_bus_read16(0x7F0004u + x1);
            soe_wram16(y + 0x3Cu) = val;
            r->x = x1;
            r->a = val;
        }
    }

    uint16_t v6a = soe_wram16(y + 0x6Au);
    r->a = v6a;
    set_nz16(r, v6a);
    if (!(v6a & 0x8000u)) {
        DP16(r, 0x4E) = v6a;
        soe_call_rom(0x8FA7D3, r);
        y = DP16(r, 0x4C);
        r->y = y;
    }

    uint16_t v6c = soe_wram16(y + 0x6Cu);
    r->a = v6c;
    set_nz16(r, v6c);
    if (!(v6c & 0x8000u)) {
        DP16(r, 0x4E) = v6c;
        soe_call_rom(0x8FA7D3, r);
        y = DP16(r, 0x4C);
        r->y = y;
    }

    cmp16(r, y, 0x4E89u);
    if (y >= 0x4E89u) {
        uint16_t v98 = soe_wram16(y + 0x98u);
        r->a = v98;
        set_nz16(r, v98);
        if (!(v98 & 0x8000u)) {
            DP16(r, 0x4E) = v98;
            soe_call_rom(0x8FA7D3, r);
            y = DP16(r, 0x4C);
            r->y = y;
            set_nz16(r, y);
        }
    }
}
