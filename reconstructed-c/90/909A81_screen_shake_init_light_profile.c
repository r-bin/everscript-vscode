/*
 * $90:9A81 screen_shake_init_light_profile (knowledge/routines/screen_shake_init_light_profile.md), RTS, 16-bit A, X, Y.
 *
 * Sets $7E:22FA and $7E:22FB to $10 and clears $2417 and $2419.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   screen_shake_init_light_profile ($909A81) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (23 bytes)
 * - Compiled C ASM:   67 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3186a4483f351781
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(screen_shake_init_light_profile, 0x909A81, RTS)
{
    SOE_AT(0x9A81);
    soe_set_a8(r, 0x10);
    soe_nz8(r, 0x10);
    RAM8(0x22FA) = 0x10;
    RAM8(0x22FB) = 0x10;
    r->p &= ~SOE_M;
    ABS16(r, CAMERA_WORLD_ORIGIN_X_ADDR) = 0;
    ABS16(r, CAMERA_WORLD_ORIGIN_Y_ADDR) = 0;
}
