/*
 * Routine: $80B406 (title_screen_background_graphics_and_palette_dma)
 * Bank: $80
 *
 * Decompresses title screen graphics from Bank $C6 into $7F:0000 via $8C:988D
 * and uploads tiles, tilemaps, and palettes to VRAM and CGRAM via $80:8650,
 * $80:8860, and $80:85FA.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   title_screen_background_graphics_and_palette_dma ($80B406) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  96 instructions (256 bytes)
 * - Compiled C ASM:   500 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8ef6fda415e95e6a
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(title_screen_background_graphics_and_palette_dma, 0x80B406, RTL) {
    uint16_t i;

    dp_u16(r, 0x36) = 0x0100;
    dp_u16(r, 0x38) = 0x00C6;
    dp_u16(r, 0x3A) = 0x0000;
    dp_u16(r, 0x3C) = 0x007F;
    r->a = 0x007F;
    soe_nz16(r, 0x007F);
    soe_call_rom(0x8C988D, r);

    dp_u16(r, 0x26) = 0x0000;
    dp_u16(r, 0x28) = 0x007F;
    dp_u16(r, 0x2E) = 0x4000;
    dp_u16(r, 0x30) = 0x0000;
    r->a = 0x0000;
    r->x = 0x2800;
    soe_nz16(r, 0x2800);
    soe_call_rom(0x808650, r);

    dp_u16(r, 0x36) = 0x174D;
    dp_u16(r, 0x38) = 0x00C6;
    dp_u16(r, 0x3A) = 0x0000;
    dp_u16(r, 0x3C) = 0x007F;
    r->a = 0x007F;
    soe_nz16(r, 0x007F);
    soe_call_rom(0x8C988D, r);

    dp_u16(r, 0x26) = 0x0000;
    dp_u16(r, 0x28) = 0x007F;
    dp_u16(r, 0x2E) = 0x0000;
    dp_u16(r, 0x30) = 0x0000;
    r->a = 0x0000;
    r->x = 0x0800;
    soe_nz16(r, 0x0800);
    soe_call_rom(0x808650, r);

    dp_u16(r, 0x36) = 0x19ED;
    dp_u16(r, 0x38) = 0x00C6;
    dp_u16(r, 0x3A) = 0x0000;
    dp_u16(r, 0x3C) = 0x007F;
    r->a = 0x007F;
    soe_nz16(r, 0x007F);
    soe_call_rom(0x8C988D, r);

    dp_u16(r, 0x26) = 0x0000;
    dp_u16(r, 0x28) = 0x007F;
    dp_u16(r, 0x2E) = 0x2000;
    dp_u16(r, 0x30) = 0x0000;
    r->a = 0x0000;
    r->x = 0x1400;
    soe_nz16(r, 0x1400);
    soe_call_rom(0x808650, r);

    ABS16(r, 0x2116) = 0x0800;
    for (i = 0; i < 0x0240; i++) {
        ABS16(r, 0x2118) = 0x2000;
    }

    dp_u16(r, 0x26) = 0x2053;
    dp_u16(r, 0x28) = 0x00C6;
    dp_u16(r, 0x2E) = 0x08A0;
    dp_u16(r, 0x30) = 0x0000;
    r->a = 0x0000;
    r->x = 0x0010;
    r->y = 0x0003;
    soe_nz16(r, 0x0003);
    soe_call_rom(0x808860, r);

    dp_u16(r, 0x26) = 0x0000;
    dp_u16(r, 0x28) = 0x00C6;
    dp_u16(r, 0x2E) = 0x0000;
    dp_u16(r, 0x30) = 0x0000;
    r->a = 0x0000;
    r->x = 0x0200;
    soe_nz16(r, 0x0200);
    soe_call_rom(0x8085FA, r);

    dp_u16(r, 0x26) = 0x19E5;
    dp_u16(r, 0x28) = 0x00C6;
    dp_u16(r, 0x2E) = 0x0000;
    dp_u16(r, 0x30) = 0x0000;
    r->a = 0x0000;
    r->x = 0x0008;
    soe_nz16(r, 0x0008);
    soe_call_rom(0x8085FA, r);
}
