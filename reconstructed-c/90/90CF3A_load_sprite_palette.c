/*
 * $90:CF3A — load_sprite_palette (RTL)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   load_sprite_palette ($90CF3A) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  48 instructions (126 bytes)
 * - Compiled C ASM:   119 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   2.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      593e77c9e26f998c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(load_sprite_palette, 0x90CF3A, RTL);
void load_sprite_palette_bind(soe_regs r)
{
    uint8_t old_db = r->db;
    r->db = 0x90u;
    uint16_t saved_y = r->y;
    uint16_t saved_x = r->x;

    r->y = r->a;
    r->x = (uint16_t)(saved_x << 4);
    for (uint16_t i = 0; i < 15u; i++) {
        uint16_t val = ROM16(0x900000u + (uint16_t)(r->y + 2u + (i << 1)));
        RAM16((uint16_t)(0x6289u + r->x + (i << 1))) = val;
        r->a = val;
    }

    r->a = r->y;
    r->x = saved_x;
    soe_call_rtl(0x90CFB8u, r);

    r->y = saved_y;
    r->db = old_db;
}

