/* Reconstructed from Secret of Evermore (USA) [$9083AC..$908417].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_anim_script_end_handler ($9083AC) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  42 instructions (108 bytes)
 * - Compiled C ASM:   502 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ee2edb3a2b234915
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

SOE_BIND(entity_anim_script_end_handler, 0x9083AC, RTS)
{
    r->p &= (uint8_t)~(SOE_FLAG_M | SOE_FLAG_X);
    uint16_t y = r->y;
    uint16_t x = ABSI16(r, 0x0088, y);
    r->x = x;
    set_nz16(r, x);
    if (x != 0) {
        r->a = ABSI16(r, 0x008A, y);
        set_nz16(r, r->a);
        soe_call_rom(0x8CCFF4, r);
        y = r->y;
        r->a = r->d;
        ABSI16(r, 0x0088, y) = r->a;
        ABSI16(r, 0x008A, y) = r->a;
    }

    uint16_t v12 = ABSI16(r, 0x0012, y);
    r->a = v12;
    if (v12 & 0x0100u) {
        uint16_t a = ABSI16(r, 0x0003, y);
        ABSI16(r, 0x0000, y) = a;
        DP16(r, 0x5D) = a;
        r->a = a;
        set_nz16(r, a);
        r->p |= SOE_FLAG_M;
        return;
    }
    if (v12 & 0x0200u) {
        uint16_t a = ABSI16(r, 0x0010, y) | 0x0001u;
        ABSI16(r, 0x0010, y) = a;
        r->a = a;
        set_nz16(r, a);
        r->p |= SOE_FLAG_M;
        return;
    }

    uint16_t v2a = ABSI16(r, 0x002A, y);
    r->a = v2a;
    set_nz16(r, v2a);
    if (v2a == 0) {
        uint16_t v68 = ABSI16(r, 0x0068, y);
        r->a = v68;
        if (v68 & 0x0200u) {
            ABSI16(r, 0x0068, y) = v68 & 0xFDFFu;
            r->a = 0x0200u;
            set_nz16(r, r->a);
            soe_call_rom(0x8CCE4D, r);
            y = r->y;
        }
        cmp16(r, y, 0x4E89u);
        if (y < 0x4E89u) {
            soe_call_rom(0x8FB2DE, r);
            y = DP16(r, 0x4C);
            r->y = y;
            set_nz16(r, y);
            r->p |= SOE_FLAG_M;
            return;
        }
    }

    uint16_t a = ABSI16(r, 0x0010, y) & 0xFFBFu;
    ABSI16(r, 0x0010, y) = a;
    r->a = a;
    set_nz16(r, a);
    r->p |= SOE_FLAG_M;
}
