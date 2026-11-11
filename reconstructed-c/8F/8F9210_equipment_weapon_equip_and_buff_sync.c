/* Reconstructed from Secret of Evermore (USA) [$8F9210..$8F9369].
 * Verification: Gate G1 (reference + fuzzed wram, regs, P).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   equipment_weapon_equip_and_buff_sync ($8F9210) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  121 instructions (349 bytes)
 * - Compiled C ASM:   547 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5ee746e4f8d58627
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

SOE_BIND(equipment_weapon_equip_and_buff_sync, 0x8F9210, RTL) {
    uint16_t x = soe_wram16(0x243D);
    r->x = x;
    set_nz16(r, x);
    if (!(x & 0x8000u)) {
        uint16_t y = soe_rom16(0x8CBBB0u + x);
        r->y = y;
        soe_wram16(y) |= soe_rom16(0x8CBBD8u + x);
        soe_wram16(0x243D) = 0xFFFFu;
        r->a = 0xFFFFu;
        set_nz16(r, r->a);
        soe_call_rom(0x8F8398, r);
        soe_call_rom(0x8F857D, r);
        r->x = 0x4E89u;
        set_nz16(r, r->x);
        soe_call_rom(0x8F9144, r);
        r->x = 0x4F37u;
        set_nz16(r, r->x);
        soe_call_rom(0x8F9144, r);
    }

    x = soe_wram16(0x243F);
    r->x = x;
    set_nz16(r, x);
    if (!(x & 0x8000u)) {
        uint16_t y = soe_rom16(0x8CBBB0u + x);
        r->y = y;
        soe_wram16(y) &= (uint16_t)(soe_rom16(0x8CBBD8u + x) ^ 0xFFFFu);
        soe_wram16(0x243F) = 0xFFFFu;
        r->a = 0xFFFFu;
        set_nz16(r, r->a);
        soe_call_rom(0x8F8398, r);
        soe_call_rom(0x8F857D, r);
        r->x = 0x4E89u;
        set_nz16(r, r->x);
        soe_call_rom(0x8F9144, r);
        r->x = 0x4F37u;
        set_nz16(r, r->x);
        soe_call_rom(0x8F9144, r);
    }

    x = soe_wram16(0x2441);
    r->x = x;
    set_nz16(r, x);
    if (x != 0) {
        if (x & 0x8000u) {
            x = 0;
            do {
                x = (uint16_t)(x + 2u);
                uint16_t y = soe_rom16(0xC459A4u + x);
                r->y = y;
                uint16_t mask = soe_rom16(0xC459C0u + x);
                uint16_t a = (uint16_t)((soe_wram16(y) | mask) ^ mask);
                soe_wram16(y) = a;
                r->a = a;
            } while (x < 0x001Au);
            r->x = x;
            soe_wram8(0x235F) = 0;
            soe_wram8(0x2360) = 0;
            soe_wram8(0x23BF) = 1;
            r->a = (uint16_t)((r->a & 0xFF00u) | 0x0001u);
            r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z)) | SOE_FLAG_C);
            soe_wram16(0x2441) = 0;
            soe_wram16(0x0ABA) = 0;
            soe_call_rom(0x8F8398, r);
        } else {
            soe_wram16(0x1434) = 0xFFFFu;
            soe_wram16(0x145D) = 0x0165u;
            soe_wram16(0x145E) = 0xCA01u;
            uint16_t a = soe_rom16(0xC459DCu + x);
            soe_wram8(0x2360) = (uint8_t)a;
            uint16_t y = soe_rom16(0xC459A4u + x);
            a = soe_rom16(0xC459C0u + x) | soe_wram16(y);
            soe_wram16(y) = a;
            r->a = a;
            set_nz16(r, a);
            soe_wram16(0x0ABA) = x;
            r->x = x & 0x00FFu;
            r->y = y & 0x00FFu;
            soe_wram8(0x235F) = (uint8_t)r->x;
            soe_wram16(0x2441) = 0;
            soe_call_rom(0x8F8398, r);
        }
    }

    uint16_t bf = soe_wram16(0x23BF);
    r->a = bf;
    set_nz16(r, bf);
    if (bf != 0) {
        r->a = r->d;
        uint16_t v1434 = soe_wram16(0x1434);
        cmp16(r, r->a, v1434);
        if (r->a == v1434) {
            return;
        }
        soe_wram16(0x1434) = r->a;
        soe_wram16(0x0A58) = 0x3EFEu;
        soe_wram16(0x0A5A) = 0x3F0Eu;
        soe_wram16(0x0A5C) = 0x3F1Eu;
        soe_wram16(0x0A66) = 0x3F2Eu;
        soe_wram16(0x0A6C) = 0x414Eu;
        soe_wram16(0x1460) = 0x3EAEu;
        soe_wram16(0x1462) = 0x3EAEu;
        soe_wram16(0x4EB7) = 0x0400u;
        soe_wram16(0x4F65) = 0x0400u;
        soe_wram16(0x4E9B) &= (uint16_t)~0x0800u;
        soe_wram16(0x4F49) &= (uint16_t)~0x0800u;
        soe_wram16(0x4EFD) = 0x0C0Cu;
        soe_wram16(0x4E95) = 0x000Cu;
        uint16_t cd = soe_wram16(0x23CD);
        uint16_t pal = (cd != 0) ? (uint16_t)(cd + 0xA7CBu) : 0xAD0Bu;
        soe_wram16(0x0A2F) = pal;
        r->a = pal;
        r->x = 0x000Cu;
        set_nz16(r, r->x);
        soe_wram16(0x1278 + 0x000Cu) = pal;
        soe_call_rom(0x90CF3A, r);
        return;
    }

    x = soe_wram16(0x0ABA);
    r->x = x;
    uint16_t v1434 = soe_wram16(0x1434);
    cmp16(r, x, v1434);
    if (x == v1434) {
        return;
    }
    soe_wram16(0x1434) = x;
    soe_call_rom(0x8F81C9, r);
}
