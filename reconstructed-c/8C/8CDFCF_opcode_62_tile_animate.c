/*
 * $8C:DFCF activate_background_tile_animation (knowledge/routines/activate_background_tile_animation.md), RTS, 16-bit A.
 *
 * Handler of script opcode 0x62 (tile_animate). Reads a channel-key byte into DP $06 and two 16-bit
 * words into DP $0A and DP $0C from the script stream [DP $82], advancing the script pointer by 5 bytes.
 * Calls $90:A2A2 (map_anim_tile_channel_search_or_activate) and returns with carry set.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   activate_background_tile_animation ($8CDFCF) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  15 instructions (31 bytes)
 * - Compiled C ASM:   204 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      702c72e9ef6ac90f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(activate_background_tile_animation, 0x8CDFCF, RTS)
{
    uint16_t a;
    uint16_t ptr;

    SOE_AT(0xDFCF);
    /* 1. Read channel key byte */
    a = (uint16_t)(LONG16(SOE_DPPTR(r, 0x82)) & 0x00FF);
    ptr = (uint16_t)(DP16(r, 0x82) + 1);
    DP16(r, 0x82) = ptr;
    DP16(r, 0x06) = a;

    SOE_AT(0xDFD8);
    /* 2. Read first word parameter into DP $0A */
    a = LONG16(SOE_DPPTR(r, 0x82));
    ptr = (uint16_t)(DP16(r, 0x82) + 2);
    DP16(r, 0x82) = ptr;
    DP16(r, 0x0A) = a;

    SOE_AT(0xDFE0);
    /* 3. Read second word parameter into DP $0C */
    a = LONG16(SOE_DPPTR(r, 0x82));
    ptr = (uint16_t)(DP16(r, 0x82) + 2);
    DP16(r, 0x82) = ptr;
    DP16(r, 0x0C) = a;

    SOE_AT(0xDFE8);
    /* 4. Call $90:A2A2 */
    soe_call_rtl(0x90A2A2UL, r);

    /* 5. SEC; RTS */
    soe_carry(r, true);
}
