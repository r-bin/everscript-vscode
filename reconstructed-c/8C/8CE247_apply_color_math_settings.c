/*
 * $8C:E247 apply_color_math_settings (knowledge/routines/apply_color_math_settings.md), RTS, 16-bit A, X, Y.
 *
 * Commits $0F80..$0F83 mirrors to PPU registers $212C, $212D, $2131, $2130 and updates bit 0 of $0B29
 * from bit 7 of $7E:22EA.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   apply_color_math_settings ($8CE247) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  19 instructions (52 bytes)
 * - Compiled C ASM:   196 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      66cb6e00819d1e36
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(apply_color_math_settings, 0x8CE247, RTS)
{
    SOE_AT(0xE247);
    r->p |= SOE_M;
    IO8(0x212C) = ABS8(r, MAP_TM_MIRROR_ADDR);
    IO8(0x212D) = ABS8(r, MAP_TS_MIRROR_ADDR);
    IO8(0x2131) = ABS8(r, MAP_CGADSUB_MIRROR_ADDR);
    IO8(0x2130) = ABS8(r, MAP_CGWSEL_MIRROR_ADDR);
    ABS8(r, HUD_DIRTY_UPDATE_FLAGS_ADDR) = (uint8_t)(ABS8(r, HUD_DIRTY_UPDATE_FLAGS_ADDR) & ~0x01);
    uint8_t a = (uint8_t)(RAM8(0x22EA) & 0x80);
    if (a != 0) {
        SOE_AT(0xE272);
        a = 0x01;
        ABS8(r, HUD_DIRTY_UPDATE_FLAGS_ADDR) = 0x01;
    }
    SOE_AT(0xE277);
    soe_set_a8(r, a);
    soe_nz8(r, a);
    r->p = (uint8_t)((r->p & ~SOE_M) | SOE_C);
}
