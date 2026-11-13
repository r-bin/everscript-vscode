/*
 * $80:B3B0 title_screen_ppu_layer_registers_init (knowledge/routines/title_screen_ppu_layer_registers_init.md), RTL, 16-bit A, X, Y.
 *
 * Configures PPU registers ($2101, $2105, $2107..$2109, $210B..$210C, $2123..$2125, $212C..$2131)
 * and WRAM shadows ($010C, $0122) for the title screen.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   title_screen_ppu_layer_registers_init ($80B3B0) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  34 instructions (86 bytes)
 * - Compiled C ASM:   370 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f33ca6dab0370471
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(title_screen_ppu_layer_registers_init, 0x80B3B0, RTL)
{
    SOE_AT(0xB3B0);
    ABS8(r, 0x2101) = 0x03;
    ABS8(r, 0x2107) = 0x00;
    ABS8(r, 0x2108) = 0x00;
    ABS8(r, 0x2109) = 0x08;
    ABS8(r, 0x210B) = 0x44;
    ABS8(r, 0x210C) = 0x02;
    ABS8(r, 0x2105) = 0x79;
    ABS8(r, PPU_SHADOW_BG34NBA_ADDR) = 0x06;
    ABS8(r, 0x212C) = 0x05;
    ABS8(r, 0x212D) = 0x02;
    ABS8(r, 0x212E) = 0x00;
    ABS8(r, 0x212F) = 0x00;
    ABS8(r, 0x2123) = 0x00;
    ABS8(r, PPU_SHADOW_W12SEL_ADDR) = 0x00;
    ABS8(r, 0x2124) = 0x00;
    ABS8(r, PPU_SHADOW_W12SEL_ADDR) = 0x00;
    ABS8(r, 0x2125) = 0x00;
    ABS8(r, 0x2131) = 0x63;
    ABS8(r, 0x2130) = 0x02;
    soe_set_a8(r, 0x02);
    soe_nz8(r, 0x02);
    r->p &= ~(SOE_M | SOE_X);
}
