/*
 * $8C:D6A7 script_op_30_32_play_sound (knowledge/routines/script_op_30_32_play_sound.md), RTS.
 *
 * Handler of script opcodes 0x30, 0x31, 0x32: play sound effect.
 * Sends pending sound command word from $7E:243B to APU via $8C:81FD (command 0x30),
 * clears $7E:243B using TDC, fetches sound index byte from script pointer [$82],
 * increments $82, translates sound index via ROM table $8C:8362,
 * and if non-negative dispatches SFX via $8C:82DC, sets Carry, and returns.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_30_32_play_sound ($8CD6A7) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  21 instructions (47 bytes)
 * - Compiled C ASM:   208 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      7d24b482471583e5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_30_32_play_sound, 0x8CD6A7, RTS)
{
    r->a = RAM16(0x243Bu);
    soe_nz16(r, r->a);
    r->y = r->a;
    soe_nz16(r, r->y);
    r->a = 0x0030u;
    soe_nz16(r, 0x0030u);
    r->db = 0x80u;
    soe_nz8(r, 0x80u);
    soe_call_rtl(0x8C81FDu, r);
    r->db = 0x7Eu;
    soe_nz8(r, 0x7Eu);

    r->a = r->d;
    soe_nz16(r, r->a);
    RAM16(0x243Bu) = r->a;

    uint32_t ptr = SOE_DPPTR(r, 0x82u);
    r->a = LONG16(ptr);
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 1u);
    r->a &= 0x00FFu;
    soe_nz16(r, r->a);

    r->db = 0x80u;
    soe_nz8(r, 0x80u);
    r->x = r->a;
    soe_nz16(r, r->x);
    r->a = ROM16(0x8C8362u + r->x);
    soe_nz16(r, r->a);
    if ((int16_t)r->a >= 0) {
        soe_call_rtl(0x8C82DCu, r);
    }
    r->db = 0x7Eu;
    soe_nz8(r, 0x7Eu);
    r->p |= SOE_C;
}
