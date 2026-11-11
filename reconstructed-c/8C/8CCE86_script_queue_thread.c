/*
 * $8C:CE86 script_queue_thread (knowledge/routines/script_queue_thread.md), RTL.
 *
 * Appends script thread ID X to the $7E:2F28 run-list at offset DP $86, writes a null
 * terminator at +2, advances DP $86 by 2, and preserves X.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_queue_thread ($8CCE86) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  11 instructions (19 bytes)
 * - Compiled C ASM:   62 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c2d5b41b21e72a16
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_queue_thread, 0x8CCE86, RTL)
{
    uint16_t saved_x = r->x;
    uint16_t cursor = DP16(r, 0x86);

    LONG16(0x7E2F28UL + cursor) = saved_x;
    cursor = (uint16_t)(cursor + 2u);
    LONG16(0x7E2F28UL + cursor) = r->d;
    DP16(r, 0x86) = cursor;

    r->a = r->d;
    r->y = saved_x;
    r->x = saved_x;
    soe_nz16(r, saved_x);
}

