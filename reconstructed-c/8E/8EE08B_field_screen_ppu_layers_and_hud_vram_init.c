/*
 * Routine: $8EE08B (field_screen_ppu_layers_and_hud_vram_init)
 * Bank: $8E
 *
 * Configures PPU screen layer registers ($2100..$2131) for field rendering
 * under forced blank ($2100 = $8F) and calls $8F:8710 to upload HUD weapon
 * stamina gauge tiles and palettes.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   field_screen_ppu_layers_and_hud_vram_init ($8EE08B) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  35 instructions (90 bytes)
 * - Compiled C ASM:   312 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      716a247bc6706b5c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(field_screen_ppu_layers_and_hud_vram_init, 0x8EE08B, RTL) {
    ABS16(r, 0x2100) = 0x008F;
    bus_write16(r, 0x0118, 0xFFFF);
    bus_write16(r, 0x0116, 0x0000);

    ABS8(r, 0x2101) = 0x03;
    ABS8(r, 0x2107) = 0x00;
    ABS8(r, 0x2108) = 0x04;
    ABS8(r, 0x2109) = 0x08;
    ABS8(r, 0x210B) = 0x22;
    ABS8(r, 0x210C) = 0x00;
    ABS8(r, 0x2105) = 0x39;
    bus_write8(r, 0x010C, 0x04);
    ABS8(r, 0x212C) = 0x17;
    ABS8(r, 0x212D) = 0x11;
    ABS8(r, 0x212E) = 0x00;
    ABS8(r, 0x212F) = 0x00;
    ABS8(r, 0x2131) = 0x42;
    ABS8(r, 0x2130) = 0x02;

    r->a = 0xFF02;
    r->p &= ~(SOE_M | SOE_X | SOE_N | SOE_Z);
    soe_call_rom(0x8F8710, r);
}
