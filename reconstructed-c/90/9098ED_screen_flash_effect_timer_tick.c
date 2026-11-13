/*
 * $90:98ED screen_flash_effect_timer_tick (knowledge/routines/screen_flash_effect_timer_tick.md), RTL, 16-bit A, X, Y.
 *
 * Decrements screen shake/flash timer DP $C9 when active; when it reaches zero, clears DP $C3, $C5, $C7, $C9.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   screen_flash_effect_timer_tick ($9098ED) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (22 bytes)
 * - Compiled C ASM:   84 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3930beaa71e5e367
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(screen_flash_effect_timer_tick, 0x9098ED, RTL)
{
    SOE_AT(0x98ED);
    r->a = DP16(r, 0xC9);
    soe_nz16(r, r->a);
    if (r->a == 0) {
        SOE_AT(0x98F6);
        return;
    }
    SOE_AT(0x98F1);
    r->a = (uint16_t)(r->a - 1);
    soe_nz16(r, r->a);
    if (r->a == 0) {
        SOE_AT(0x988E);
        DP16(r, 0xC3) = 0;
        DP16(r, 0xC5) = 0;
        DP16(r, 0xC7) = 0;
        DP16(r, 0xC9) = 0;
        return;
    }
    SOE_AT(0x98F4);
    DP16(r, 0xC9) = r->a;
}
