/* Reconstructed from Secret of Evermore (USA) [$90CCF6..$90CD7F].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   combat_enemy_defeated_soul_vapor_fx_init ($90CCF6) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  58 instructions (138 bytes)
 * - Compiled C ASM:   450 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8debb8ae2d371fa3
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

static inline void cmp16(soe_regs r, uint16_t a, uint16_t b) {
    uint16_t d = (uint16_t)(a - b);
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z | SOE_FLAG_C)) |
                     (a >= b ? SOE_FLAG_C : 0) |
                     (d == 0 ? SOE_FLAG_Z : 0) |
                     ((d & 0x8000u) ? SOE_FLAG_N : 0));
}

SOE_BIND(combat_enemy_defeated_soul_vapor_fx_init, 0x90CCF6, RTL)
{
    uint8_t saved_dbr = r->db;
    r->db = 0x7E;
    uint16_t y = DP16(r, 0x4C);
    r->y = y;
    uint16_t x = ABSI16(r, 0x0060, y);
    r->x = x;

    uint16_t a = LONG16(0x8E000Bu + x);
    r->a = a;
    set_nz16(r, a);
    if (a != 0) {
        uint16_t v127a = soe_wram16(0x127A);
        cmp16(r, a, v127a);
        if (a != v127a) {
            r->x = 0x0002u;
            soe_wram16(0x127A) = a;
            set_nz16(r, r->x);
            soe_call_rom(0x90CF3A, r);
            y = DP16(r, 0x4C);
            r->y = y;
            x = ABSI16(r, 0x0060, y);
            r->x = x;
        }
        a = LONG16(0x8E0009u + x);
        r->a = a;
        uint16_t v1278 = soe_wram16(0x1278);
        cmp16(r, a, v1278);
        if (a != v1278) {
            r->x = 0x0000u;
            soe_wram16(0x1278) = a;
            set_nz16(r, r->x);
            soe_call_rom(0x90CF3A, r);
        }
        soe_wram16(0x1432) = 0x0003u;
        y = DP16(r, 0x4C);
        r->y = y;
        ABSI16(r, 0x0074, y) = 0x0000u;
        ABSI16(r, 0x000C, y) = 0x0000u;
        r->a = 0x0000u;
        r->db = saved_dbr;
        set_nz8(r, saved_dbr);
        return;
    }

    a = LONG16(0x8E0009u + x);
    r->a = a;
    set_nz16(r, a);
    if (a == 0) {
        ABSI16(r, 0x000C, y) = 0x0008u;
        ABSI16(r, 0x0074, y) = 0x0808u;
        r->a = 0x0808u;
        r->db = saved_dbr;
        set_nz8(r, saved_dbr);
        return;
    }

    r->x = a;
    y = DP16(r, 0x4C);
    r->y = y;
    ABSI16(r, 0x0074, y) = 0x0404u;
    r->a = r->x;
    set_nz16(r, r->a);
    soe_call_rom(0x90CD80, r);
    r->a = r->x;
    ABSI8(r, 0x000C, y) = (uint8_t)r->a;
    ABSI8(r, 0x0074, y) = (uint8_t)r->a;
    ABSI8(r, 0x0075, y) = (uint8_t)r->a;
    r->p &= (uint8_t)~(SOE_FLAG_M | SOE_FLAG_X);
    r->db = saved_dbr;
    set_nz8(r, saved_dbr);
}
