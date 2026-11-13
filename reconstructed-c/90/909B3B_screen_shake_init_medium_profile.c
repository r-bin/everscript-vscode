/*
 * Routine: screen_shake_init_medium_profile ($90:9B3B)
 * Enable the active shake/weather subsystem ($14E4 = 1), set medium shake
 * amplitude/parameters ($7E22FA = $14, $7E22FB = $14), and clear $2417/$2419.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   screen_shake_init_medium_profile ($909B3B) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  11 instructions (29 bytes)
 * - Compiled C ASM:   81 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      99bdcc3f8bdd0d8f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(screen_shake_init_medium_profile, 0x909B3B, RTS) {
    ABS16(r, WEATHER_SYSTEM_ACTIVE_FLAG_ADDR) = 0x0001u;
    RAM8(0x22FAu) = 0x14u;
    RAM8(0x22FBu) = 0x14u;
    ABS16(r, 0x2417u) = 0x0000u;
    ABS16(r, 0x2419u) = 0x0000u;

    r->a = 0x0014u;
    soe_nz8(r, 0x14u);
    r->p &= (uint8_t)~SOE_M;
}

