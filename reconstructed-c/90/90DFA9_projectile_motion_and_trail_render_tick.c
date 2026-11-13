/**
 * Routine: $90:DFA9 (projectile_motion_and_trail_render_tick)
 * Bank: $90 (ROM Offset: $10DFA9)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_motion_and_trail_render_tick ($90DFA9) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  28 instructions (59 bytes)
 * - Compiled C ASM:   344 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      47890dba095de2fc
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(projectile_motion_and_trail_render_tick, 0x90DFA9, RTS);

void projectile_motion_and_trail_render_tick_bind(soe_regs r) {
    r->x = r->y;
    uint16_t ttl = (uint16_t)(ABSI16(r, 0x0024u, r->x) - 1u);
    ABSI16(r, 0x0024u, r->x) = ttl;
    if (ttl & 0x8000u) {
        r->a = r->d;
        soe_nz16(r, r->a);
        ABSI16(r, 0x0010u, r->y) = r->a;
        return;
    }
    DP16(r, 0x46u) = (uint16_t)(ABSI16(r, 0x0014u, r->y) - DP16(r, 0x59u));
    DP16(r, 0x48u) = (uint16_t)(ABSI16(r, 0x0016u, r->y) - DP16(r, 0x5Bu));
    DP16(r, 0x3Eu) = (uint16_t)(ABSI16(r, 0x0020u, r->y) - DP16(r, 0x59u));
    DP16(r, 0x40u) = (uint16_t)(ABSI16(r, 0x0022u, r->y) - DP16(r, 0x5Bu));
    uint16_t attr = (uint16_t)(ABSI16(r, 0x000Cu, r->y) | 0x0030u);
    r->a = attr;
    soe_nz16(r, attr);
    DP16(r, 0x06u) = attr;
    soe_call_rtl(0x91CB9Au, r);
}
