/**
 * Routine: $8C:D400 (script_op_07_start_thread)
 * Bank: $8C (ROM Offset: $0CD400)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_07_start_thread ($8CD400) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  19 instructions (40 bytes)
 * - Compiled C ASM:   282 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      79c980a419844ecb
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_07_start_thread, 0x8CD400, RTS);

void script_op_07_start_thread_bind(soe_regs r) {
    DP16(r, 0x26u) = LONG16(SOE_DPPTR(r, 0x82u));
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 2u);
    DP16(r, 0x28u) = LONG16(SOE_DPPTR(r, 0x82u));
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 1u);
    soe_call_rtl(0x8CCF18u, r);
    r->y = DP16(r, 0x7Eu);
    uint16_t ctx = ABSI16(r, 0x000Du, r->y);
    r->a = ctx;
    ABSI16(r, 0x000Du, r->x) = ctx;
    if (ctx != 0u) {
        r->y = r->x;
        r->x = ctx;
        ABSI16(r, 0x003Eu, r->x) = (uint16_t)(ABSI16(r, 0x003Eu, r->x) + 1u);
        r->x = r->y;
    }
    soe_call_rtl(0x8CCE86u, r);
    soe_carry(r, true);
}
