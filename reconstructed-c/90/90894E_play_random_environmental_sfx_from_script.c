/*
 * Routine: $90:894E (play_random_environmental_sfx_from_script)
 * Bank: $90 (ROM Offset: $10894E)
 * Calling convention: RTS
 *
 * Plays environmental sound effects triggered from script bytecode.
 * Validates entity range $3DE5..$4FE5 and state flags +$14,Y.
 * Reads sound effect index from script pointer [<$5D], advances pointer,
 * queries RNG ($80:859B), and if (RNG & 0xC000) != 0, plays sound effect
 * from $8C:8362,X via $8C:82DC.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   play_random_environmental_sfx_from_script ($90894E) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  27 instructions (54 bytes)
 * - Compiled C ASM:   241 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f6335876463b923b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(play_random_environmental_sfx_from_script, 0x90894E, RTS)
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

    soe_call_rtl(0x80859Bu, r);

    if ((r->a & 0xC000u) != 0u) {
        r->p &= (uint8_t)~SOE_Z;
        uint16_t sfx = LONG16(0x8C8362UL + r->x);
        r->a = sfx;
        soe_nz16(r, sfx);
        if ((int16_t)sfx >= 0) {
            soe_call_rtl(0x8C82DCu, r);
        }
    } else {
        r->p |= SOE_Z;
    }

    r->y = saved_y;
    r->p |= SOE_M;
    r->db = saved_db;
    soe_nz8(r, saved_db);
}

