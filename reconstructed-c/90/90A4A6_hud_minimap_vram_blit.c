/*
 * $90:A4A6 hud_minimap_vram_blit (knowledge/routines/hud_minimap_vram_blit.md), RTS.
 *
 * Commit prepared minimap radar tile buffer to VRAM with DMA safety lock.
 * If DP $B0 == 0, returns early with Carry clear.
 * Otherwise locks VRAM queue ($0F3A++), streams radar metatiles within window bounds ($0F8C..$0F9A)
 * into VRAM staging ring buffers at $1174 and $11F4, updates cell coordinates ($0FB8/$0FBA),
 * manages VRAM DMA triggers ($0FC2), and unlocks VRAM queue ($0F3A--) upon completion or exhaustion.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   hud_minimap_vram_blit ($90A4A6) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  117 instructions (276 bytes)
 * - Compiled C ASM:   1323 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      48bc807d3186dc7c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(hud_minimap_vram_blit, 0x90A4A6, RTS)
{
    if (DP16(r, 0xB0u) == 0u) {
        r->a = 0u;
        soe_carry(r, false);
        soe_nz16(r, 0u);
        return;
    }

    ABS16(r, 0x0F3Au) = (uint16_t)(ABS16(r, 0x0F3Au) + 1u);
    uint16_t y = ABS16(r, 0x1170u);

    while (1) {
        int16_t chunks = (int16_t)ABS16(r, 0x116Eu);
        if (chunks < 0) {
            ABS16(r, 0x1170u) = y;
            uint16_t f3a = (uint16_t)(ABS16(r, 0x0F3Au) - 1u);
            ABS16(r, 0x0F3Au) = f3a;
            r->a = (uint16_t)chunks;
            r->y = y;
            soe_carry(r, true);
            soe_nz16(r, f3a);
            return;
        }

        uint16_t fc2 = ABS16(r, 0x0FC2u);
        bool c = (fc2 & 1u) != 0;
        fc2 >>= 1;
        ABS16(r, 0x0FC2u) = fc2;

        if (c) {
            if (fc2 == 0u) {
                uint32_t ptr_b0 = SOE_DPPTR(r, 0xB0u);
                uint16_t b0_val = LONG16(ptr_b0);
                DP16(r, 0xB0u) = (uint16_t)(DP16(r, 0xB0u) + 1u);
                uint16_t a = (uint16_t)(((b0_val & 0x00FFu) | 0x0100u) >> 1);
                ABS16(r, 0x0FC2u) = a;
                c = (((b0_val & 0x00FFu) | 0x0100u) & 1u) != 0;
            }
        }

        if (c) {
            uint32_t ptr_ad = SOE_DPPTR(r, 0xADu);
            uint16_t x = LONG16(ptr_ad);
            uint16_t d12 = LONG16(0x7F0000UL | x);
            DP16(r, 0x12u) = d12;
            uint16_t d14 = LONG16(0x7F0000UL | (uint16_t)(x + 2u));
            DP16(r, 0x14u) = d14;

            uint32_t ptr_b0 = SOE_DPPTR(r, 0xB0u);
            x ^= LONG16(ptr_b0);
            LONG16(ptr_ad) = x;
            DP16(r, 0xB0u) = (uint16_t)(DP16(r, 0xB0u) + 2u);

            uint16_t tile0 = LONG16(0x7F0000UL | x);
            if (tile0 != d12) {
                ABS16(r, 0x1174u + y) = tile0;
                uint16_t y_coord = ABS16(r, 0x0FBAu);
                if (y_coord >= ABS16(r, 0x0F8Cu) && y_coord < ABS16(r, 0x0F8Eu)) {
                    uint16_t x_coord = ABS16(r, 0x0FB8u);
                    if (x_coord >= ABS16(r, 0x0F90u) && x_coord < ABS16(r, 0x0F92u)) {
                        ABS16(r, 0x11F4u + y) = (uint16_t)((x_coord & 0x001Fu) | ABS16(r, 0x0FB4u));
                        y = (uint16_t)(y + 2u);
                        if (y == 0x0080u) y = 0u;
                        ABS16(r, 0x116Eu) = (uint16_t)(ABS16(r, 0x116Eu) - 1u);
                    }
                }
            }

            uint16_t tile1 = LONG16(0x7F0000UL | (uint16_t)(x + 2u));
            if (tile1 != d14) {
                ABS16(r, 0x1174u + y) = tile1;
                uint16_t y_coord = ABS16(r, 0x0FBAu);
                if (y_coord >= ABS16(r, 0x0F94u) && y_coord < ABS16(r, 0x0F96u)) {
                    uint16_t x_coord = ABS16(r, 0x0FB8u);
                    if (x_coord >= ABS16(r, 0x0F98u) && x_coord < ABS16(r, 0x0F9Au)) {
                        ABS16(r, 0x11F4u + y) = (uint16_t)((x_coord & 0x001Fu) | ABS16(r, 0x0FB4u) | 0x0400u);
                        y = (uint16_t)(y + 2u);
                        if (y == 0x0080u) y = 0u;
                        ABS16(r, 0x116Eu) = (uint16_t)(ABS16(r, 0x116Eu) - 1u);
                    }
                }
            }
        }

        uint16_t fb8 = (uint16_t)(ABS16(r, 0x0FB8u) + 1u);
        if (fb8 != ABS16(r, 0x0FBEu)) {
            ABS16(r, 0x0FB8u) = fb8;
            DP16(r, 0xADu) = (uint16_t)(DP16(r, 0xADu) + 2u);
            continue;
        }

        uint16_t fba = (uint16_t)(ABS16(r, 0x0FBAu) + 1u);
        if (fba == ABS16(r, 0x0FC0u)) {
            DP16(r, 0xB0u) = 0u;
            ABS16(r, 0x1170u) = y;
            uint16_t f3a = (uint16_t)(ABS16(r, 0x0F3Au) - 1u);
            ABS16(r, 0x0F3Au) = f3a;
            r->a = fba;
            r->y = y;
            soe_carry(r, false);
            soe_nz16(r, f3a);
            return;
        }

        ABS16(r, 0x0FBAu) = fba;
        ABS16(r, 0x0FB8u) = ABS16(r, 0x0FBCu);
        uint16_t fb6 = (uint16_t)(ABS16(r, 0x0FB6u) + ABS16(r, 0x0F46u));
        ABS16(r, 0x0FB6u) = fb6;
        DP16(r, 0xADu) = fb6;
        uint16_t fb4 = (uint16_t)((ABS16(r, 0x0FB4u) + 0x0020u) & 0x03FFu);
        ABS16(r, 0x0FB4u) = fb4;
    }
}
