/*
 * Routine: $90:8921 (animation_script_play_direct_sfx)
 * Bank: $90 (ROM Offset: $108921)
 * Calling convention: RTS
 *
 * Plays a direct sound effect from the animation script stream [<$5D].
 * Validates entity bounds, fetches 16-bit SFX ID from sound table $8C:8362,X,
 * advances the script pointer by 1 byte, and dispatches via $8C:82DC.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_play_direct_sfx ($908921) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (45 bytes)
 * - Compiled C ASM:   216 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a469d4258680c70a
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(animation_script_play_direct_sfx, 0x908921, RTS)
{
    r->p &= (uint8_t)~SOE_C;

    if (r->y >= 0x3DE5u && r->y < 0x4FE5u) {
        uint8_t flags = ABSI8(r, 0x0014u, r->y);
        r->a = (uint16_t)((r->a & 0xFF00u) | flags);
        soe_nz8(r, flags);
        if (flags & 0x20u) {
            r->p &= (uint8_t)~SOE_Z;
            return;
        }
        r->p |= SOE_Z;
    }

    uint8_t saved_db = r->db;
    r->db = 0x90u;
    uint16_t saved_y = r->y;

    uint8_t idx = (uint8_t)(LONG16(SOE_DPPTR(r, 0x5Du)) & 0xFFu);

    r->p &= (uint8_t)~SOE_M;
    r->a = (uint16_t)(idx << 1);
    DP16(r, 0x5Du) = (uint16_t)(DP16(r, 0x5Du) + 1u);
    r->x = r->a;

    uint16_t sfx = LONG16(0x8C8362UL + r->x);
    r->a = sfx;
    soe_nz16(r, sfx);

    if ((int16_t)sfx >= 0) {
        soe_call_rtl(0x8C82DCu, r);
    }

    r->y = saved_y;
    r->p |= SOE_M;
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
