/**
 * Routine: $8C:D3A0 (script_op_call_global)
 * Bank: $8C (ROM Offset: $0CD3A0)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_call_global ($8CD3A0) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  33 instructions (73 bytes)
 * - Compiled C ASM:   331 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f7ec5b86b94f1e4b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_call_global, 0x8CD3A0, RTS);

void script_op_call_global_bind(soe_regs r) {
    uint16_t id = (uint16_t)(LONG16(SOE_DPPTR(r, 0x82u)) & 0x00FFu);
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 1u);
    DP16(r, 0x02u) = id;
    uint16_t off = (uint16_t)(id * 3u + ROM16(0x928008u) + ROM16(0x928000u));
    r->x = off;
    DP16(r, 0x26u) = ROM16(0x928000u + off);
    DP16(r, 0x28u) = (uint16_t)(ROM16(0x928002u + off) & 0x00FFu);
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
