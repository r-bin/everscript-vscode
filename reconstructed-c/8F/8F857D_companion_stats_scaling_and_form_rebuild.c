/*
 * Routine: $8F857D (companion_stats_scaling_and_form_rebuild)
 * Bank: $8F
 *
 * Recomputes the Dog companion's combat stats ($0A7F max HP, $0A89 attack,
 * $0A8B defense, $0A8D evade, $0A91 hit rate, $0A8F magic defense) from
 * level curves in Bank $8C, active charms ($7E:2261..$7E:2263), equipped
 * collar ($0ABE), and Toaster Dog transformation ($2363 == $000C).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   companion_stats_scaling_and_form_rebuild ($8F857D) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  105 instructions (268 bytes)
 * - Compiled C ASM:   441 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ef4f8fe3c3376417
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static uint16_t add_with_flags(soe_regs r, uint16_t a, uint16_t b) {
    uint32_t sum = (uint32_t)a + (uint32_t)b;
    uint16_t res = (uint16_t)sum;
    if ((~(a ^ b) & (a ^ res) & 0x8000u) != 0) r->p |= SOE_V; else r->p &= ~SOE_V;
    if (sum > 0xFFFFu) r->p |= SOE_C; else r->p &= ~SOE_C;
    return res;
}

SOE_BIND(companion_stats_scaling_and_form_rebuild, 0x8F857D, RTL) {
    uint8_t saved_db = r->db;
    uint16_t x, a_val, collar_def;

    r->db = 0x7E;
    x = (uint16_t)(wram_u16(0x0A9A) << 1);

    /* 1. Max HP ($0A7F) and current HP clamp ($4F61) */
    if ((wram_u16(0x2261) & 0x0040u) != 0) {
        a_val = R16(0x8C951Fu + x);
    } else {
        a_val = R16(0x8C9515u + x);
    }
    if (((a_val - 0x03E7u) & 0x8000u) == 0) {
        a_val = 0x03E7u;
    }
    wram_u16(0x0A7F) = a_val;
    if (((a_val - wram_u16(0x4F61)) & 0x8000u) != 0) {
        wram_u16(0x4F61) = a_val;
    }

    /* 2. Attack ($0A89) */
    if ((wram_u16(0x2263) & 0x0001u) != 0) {
        a_val = R16(0x8C96DBu + x);
    } else {
        a_val = R16(0x8C96D1u + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4FD7));
    wram_u16(0x0A89) = a_val;

    /* 3. Defense ($0A8B) */
    if ((wram_u16(0x2262) & 0x0080u) != 0) {
        a_val = R16(0x8C95FDu + x);
    } else {
        a_val = R16(0x8C95F3u + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4FD9));
    wram_u16(0x0A8B) = a_val;

    /* 4. Evade ($0A8D) */
    if ((wram_u16(0x2263) & 0x0004u) != 0) {
        a_val = R16(0x8C97B9u + x);
    } else {
        a_val = R16(0x8C97AFu + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4FDF));
    wram_u16(0x0A8D) = a_val;

    /* 5. Hit rate ($0A91), capped at 99 ($0063) */
    if ((wram_u16(0x2262) & 0x0001u) != 0) {
        a_val = R16(0x8C90C9u + x);
    } else {
        a_val = R16(0x8C90BFu + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4FDD));
    if (((a_val - 0x0063u) & 0x8000u) == 0) {
        a_val = 0x0063u;
    }
    wram_u16(0x0A91) = a_val;

    /* 6. Magic defense ($0A8F), capped at 99 ($0063) */
    if ((wram_u16(0x2263) & 0x0002u) != 0) {
        a_val = R16(0x8C8FEBu + x);
    } else {
        a_val = R16(0x8C8FE1u + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4FDB));
    if (((a_val - 0x0063u) & 0x8000u) == 0) {
        a_val = 0x0063u;
    }
    wram_u16(0x0A8F) = a_val;

    /* 7. Equipped collar defense ($0ABE) */
    a_val = 0;
    x = wram_u16(0x0ABE);
    if (x != 0) {
        collar_def = add_with_flags(r, 0, R16(0xC40000u + x));
        dp_u16(r, 0x12) = collar_def;
        if ((wram_u16(0x2261) & 0x0020u) != 0) {
            a_val = add_with_flags(r, collar_def >> 4, collar_def);
        } else {
            a_val = collar_def;
        }
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x0A8B));
    wram_u16(0x0A8B) = a_val;

    /* 8. Toaster Dog form ($2363 == $000C) bonus */
    x = wram_u16(0x2363);
    if (x >= 0x000Cu) r->p |= SOE_C; else r->p &= ~SOE_C;
    if (x == 0x000Cu) {
        a_val = add_with_flags(r, 0x0050u, wram_u16(0x0A89));
        wram_u16(0x0A89) = a_val;
        a_val = add_with_flags(r, 0x00FAu, wram_u16(0x0A8B));
        wram_u16(0x0A8B) = a_val;
    }

    r->a = a_val;
    r->x = x;
    r->db = saved_db;
    soe_nz8(r, r->db);
}
