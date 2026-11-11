/* Reconstructed from Secret of Evermore (USA) [$9098A5..$9098EC].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   screen_shake_jitter ($9098A5) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  31 instructions (72 bytes)
 * - Compiled C ASM:   163 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ab34569ed3ebcb9d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static inline void set_nz16(soe_regs r, uint16_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z)) |
                     (v == 0 ? SOE_FLAG_Z : 0) |
                     ((v & 0x8000u) ? SOE_FLAG_N : 0));
}

SOE_BIND(screen_shake_jitter, 0x9098A5, RTL) {
    uint16_t c3 = DP16(r, 0xC3);
    r->a = c3;
    set_nz16(r, c3);
    if (c3 == 0) {
        return;
    }

    soe_call_rom(0x80859B, r);
    soe_bus_write8(0x004202, (uint8_t)(r->a & 0xFFu));
    uint8_t b1 = (uint8_t)((soe_wram8(0x2409) << 1) + 1u);
    soe_bus_write8(0x004203, b1);

    uint16_t p1 = (soe_bus_read16(0x004216) & 0xFF00u) >> 8;
    uint16_t sub1 = soe_wram16(0x2409);
    DP16(r, 0xC5) = (uint16_t)(p1 - sub1);

    soe_bus_write8(0x004202, soe_wram8(0x0134));
    uint8_t b2 = (uint8_t)((soe_wram8(0x240B) << 1) + 1u);
    soe_bus_write8(0x004203, b2);

    r->p &= (uint8_t)~(SOE_FLAG_M | SOE_FLAG_X);
    uint16_t p2 = (soe_bus_read16(0x004216) & 0xFF00u) >> 8;
    uint16_t sub2 = soe_wram16(0x240B);
    uint32_t diff2 = (uint32_t)p2 + (uint32_t)(sub2 ^ 0xFFFFu) + 1u;
    if (((p2 ^ sub2) & (p2 ^ (uint16_t)diff2) & 0x8000u) != 0) {
        r->p |= SOE_FLAG_V;
    } else {
        r->p &= (uint8_t)~SOE_FLAG_V;
    }
    if (diff2 > 0xFFFFu) {
        r->p |= SOE_FLAG_C;
    } else {
        r->p &= (uint8_t)~SOE_FLAG_C;
    }
    r->a = (uint16_t)diff2;
    DP16(r, 0xC7) = r->a;
    set_nz16(r, r->a);
}
