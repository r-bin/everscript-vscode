/*
 * Routine: $8F8398 (character_defense_and_buff_rebuild)
 * Bank: $8F
 *
 * Recomputes the Boy's combat stats ($0A35 max HP, $0A3F attack, $0A41 defense,
 * $0A43 evade, $0A47 hit rate, $0A45 magic defense) from level curves in
 * Bank $8C, active alchemy buffs ($7E:2261..$7E:2263), equipped weapon
 * ($0ABA), and equipped armor pieces ($0AC0, $0AC2, $0AC4).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   character_defense_and_buff_rebuild ($8F8398) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  137 instructions (349 bytes)
 * - Compiled C ASM:   591 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0090a33c73e8ace1
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

SOE_BIND(character_defense_and_buff_rebuild, 0x8F8398, RTL) {
    uint8_t saved_db = r->db;
    uint16_t x, a_val, armor_sum;

    r->db = 0x7E;
    x = (uint16_t)(wram_u16(0x0A50) << 1);

    /* 1. Max HP ($0A35) and current HP clamp ($4EB3) */
    if ((wram_u16(0x2261) & 0x0040u) != 0) {
        a_val = R16(0x8C91A7u + x);
    } else {
        a_val = R16(0x8C919Du + x);
    }
    if (((a_val - 0x03E7u) & 0x8000u) == 0) {
        a_val = 0x03E7u;
    }
    wram_u16(0x0A35) = a_val;
    if (((a_val - wram_u16(0x4EB3)) & 0x8000u) != 0) {
        wram_u16(0x4EB3) = a_val;
    }

    /* 2. Attack ($0A3F) */
    if ((wram_u16(0x2263) & 0x0001u) != 0) {
        a_val = R16(0x8C9363u + x);
    } else {
        a_val = R16(0x8C9359u + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4F29));
    wram_u16(0x0A3F) = a_val;

    /* 3. Defense ($0A41) */
    if ((wram_u16(0x2262) & 0x0080u) != 0) {
        a_val = R16(0x8C9285u + x);
    } else {
        a_val = R16(0x8C927Bu + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4F2B));
    wram_u16(0x0A41) = a_val;

    /* 4. Evade ($0A43) */
    if ((wram_u16(0x2263) & 0x0004u) != 0) {
        a_val = R16(0x8C9445u + x);
    } else {
        a_val = R16(0x8C9437u + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4F31));
    wram_u16(0x0A43) = a_val;

    /* 5. Hit rate ($0A47), capped at 99 ($0063) */
    if ((wram_u16(0x2262) & 0x0001u) != 0) {
        a_val = R16(0x8C8F0Du + x);
    } else {
        a_val = R16(0x8C8F03u + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4F2F));
    if (((a_val - 0x0063u) & 0x8000u) == 0) {
        a_val = 0x0063u;
    }
    wram_u16(0x0A47) = a_val;

    /* 6. Magic defense ($0A45), capped at 99 ($0063) */
    if ((wram_u16(0x2263) & 0x0002u) != 0) {
        a_val = R16(0x8C8E2Fu + x);
    } else {
        a_val = R16(0x8C8E25u + x);
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x4F2D));
    if (((a_val - 0x0063u) & 0x8000u) == 0) {
        a_val = 0x0063u;
    }
    wram_u16(0x0A45) = a_val;

    /* 7. Equipped weapon bonus ($0ABA) */
    x = wram_u16(0x0ABA);
    if (x != 0) {
        if (x == 0x001Au) {
            a_val = add_with_flags(r, wram_u16(0x0A3F), 0x0012u);
            wram_u16(0x1468) = a_val;
            x = wram_u16(0x2349) & 0x00FFu;
            x = R16(0xC4388Eu + x);
            wram_u16(0x0A3F) = R16(0xC40000u + x);
        } else {
            dp_u16(r, 0x12) = x;
            x = R16(0xC43874u + x);
            a_val = add_with_flags(r, R16(0xC40000u + x), wram_u16(0x0A3F));
            wram_u16(0x0A3F) = a_val;
            x = dp_u16(r, 0x12);
            a_val = R16(0xC459DCu + x);
            r->p |= SOE_C;
            if (a_val == 0x0000u) {
                x = R16(0xC43874u + x);
                a_val = R16(0xC40000u + x) >> 2;
                a_val = add_with_flags(r, a_val, wram_u16(0x0A3F));
                wram_u16(0x0A3F) = a_val;
            }
        }
    }

    /* 8. Equipped armor pieces ($0AC0, $0AC2, $0AC4) */
    armor_sum = 0;
    x = wram_u16(0x0AC0);
    if (x != 0) {
        armor_sum = add_with_flags(r, armor_sum, R16(0xC40000u + x));
    }
    x = wram_u16(0x0AC2);
    if (x != 0) {
        armor_sum = add_with_flags(r, armor_sum, R16(0xC40000u + x));
    }
    x = wram_u16(0x0AC4);
    if (x != 0) {
        armor_sum = add_with_flags(r, armor_sum, R16(0xC40000u + x));
    }
    dp_u16(r, 0x12) = armor_sum;

    if ((wram_u16(0x2261) & 0x0020u) != 0) {
        a_val = add_with_flags(r, armor_sum >> 4, armor_sum);
    } else {
        a_val = armor_sum;
    }
    a_val = add_with_flags(r, a_val, wram_u16(0x0A41));
    wram_u16(0x0A41) = a_val;

    r->a = a_val;
    r->x = x;
    r->db = saved_db;
    soe_nz8(r, r->db);
}
