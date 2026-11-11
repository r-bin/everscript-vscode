/*
 * $8D:A07F ring_menu_load_icon_palette_attributes (knowledge/routines/ring_menu_load_icon_palette_attributes.md), RTL, 16-bit A, X, Y.
 *
 * Reads ring menu palette index from $0B21 into X and copies the 2-word entry from ROM $8D:A091/$8D:A095
 * into $0B25 and $0B23.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   ring_menu_load_icon_palette_attributes ($8DA07F) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (18 bytes)
 * - Compiled C ASM:   84 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      9f945e6fdee6ab89
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(ring_menu_load_icon_palette_attributes, 0x8DA07F, RTL)
{
    SOE_AT(0xA07F);
    r->x = ABS16(r, MENU_AUDIO_PAN_DIVISOR_ADDR);
    r->a = LONG16(0x8DA091UL + r->x);
    ABS16(r, MENU_AUDIO_SFX_VOLUME_ADDR) = r->a;
    r->a = LONG16(0x8DA095UL + r->x);
    ABS16(r, MENU_AUDIO_SFX_PITCH_ADDR) = r->a;
    soe_nz16(r, r->a);
}
