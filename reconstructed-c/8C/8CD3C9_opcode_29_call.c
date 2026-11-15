/**
 * Routine: $8C:D3C9 (script_op_29_call)
 * Bank: $8C (ROM Offset: $0CD3C9)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CD3DA ($8CD3DA) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  18 instructions (35 bytes)
 * - Compiled C ASM:   337 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   18.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      acb36a70681511d4
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_29_call, 0x8CD3C9, RTS);
SOE_BIND(sub_8CD3DA, 0x8CD3DA, RTS);

void sub_8CD3DA_bind(soe_regs r) {
    soe_call_rtl(0x8CCF18u, r);
    uint16_t caller = DP16(r, 0x7Eu);
    r->y = caller;
    ABSI16(r, 0x000Bu, r->x) = caller;
    uint16_t ctx = ABSI16(r, 0x000Du, caller);
    ABSI16(r, 0x000Du, r->x) = ctx;
    uint16_t new_slot = r->x;
    r->x = ctx;
    if (ctx != 0u) {
        ABSI16(r, 0x003Eu, ctx) = (uint16_t)(ABSI16(r, 0x003Eu, ctx) + 1u);
    }
    r->a = new_slot;
    uint16_t sp = DP16(r, 0x80u);
    ABSI16(r, 0x2F28u, sp) = new_slot;
    sp = (uint16_t)(sp - 2u);
    r->y = sp;
    DP16(r, 0x80u) = sp;
    soe_nz16(r, sp);
    soe_carry(r, false);
}

void script_op_29_call_bind(soe_regs r) {
    DP16(r, 0x26u) = LONG16(SOE_DPPTR(r, 0x82u));
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 2u);
    DP16(r, 0x28u) = (uint16_t)(LONG16(SOE_DPPTR(r, 0x82u)) & 0x00FFu);
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 1u);
    sub_8CD3DA_bind(r);
}