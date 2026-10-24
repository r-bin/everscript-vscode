/*
 * $8F:9937 companion_waypoint_anchor_init (knowledge/rom/8f9937.md), RTL, 16-bit A and X.
 *
 * Starts a follower's breadcrumb list. X = DP $4E (the follower's list record), Y = DP $4C (the
 * leader): rec[$3C01] = X, rec[$3BFF] (list end) = X + 3, rec[$3C10] = 0, the first breadcrumb
 * ($3BC9..$3BCB) = the leader's position bytes (+$62, +$63, +$18: the word at +$17 is written first,
 * then +$62 over its low byte), rec[$3BFC] = $FFFF, rec[$3C12] &= $1000; then the history poll
 * ($8F:A723) runs on it.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   companion_waypoint_anchor_init ($8F9937) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  54 instructions (129 bytes)
 * - Compiled C ASM:   266 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      40c985e043ad28c8
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

void companion_waypoint_history_poll_bind(soe_regs r);

SOE_BIND(companion_waypoint_anchor_init, 0x8F9937, RTL)
{
    uint16_t x = DP16(r, 0x4E), y = DP16(r, 0x4C), a;

    r->x = x;
    r->y = y;
    ABSI16(r, 0x3C01, x) = x;
    soe_carry(r, false);
    ABSI16(r, 0x3BFF, x) = soe_adc16(r, x, 0x0003);
    ABSI16(r, 0x3C10, x) = 0;
    ABSI16(r, 0x3BCA, x) = ABSI16(r, 0x0017, y);
    ABSI16(r, 0x3BC9, x) = ABSI16(r, 0x0062, y);
    ABSI16(r, 0x3BFC, x) = 0xFFFF;
    a = (uint16_t)(ABSI16(r, 0x3C12, x) & 0x1000);
    ABSI16(r, 0x3C12, x) = a;
    r->a = a;
    soe_nz16(r, a);
    companion_waypoint_history_poll_bind(r);                 /* JMP $A723 */
}