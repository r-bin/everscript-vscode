/**
 * Routine: $8C:DD19 (script_spawn_commit)
 * Bank: $8C (ROM Offset: $0CDD19)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CDD01 ($8CDD01) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  25 instructions (50 bytes)
 * - Compiled C ASM:   107 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3fb53eb522dd9ad9
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_spawn_commit, 0x8CDD19, RTS);

void script_spawn_commit_bind(soe_regs r) {
    soe_call_rtl(0x8FA933u, r);
    uint16_t flags = DP16(r, 0x08u);
    r->a = flags;
    soe_nz16(r, flags);
    if ((flags & 0x8000u) == 0u) {
        soe_call_rtl(0x8FB094u, r);
        ABS16(r, 0x0341u) = r->x;
    } else {
        soe_call_rtl(0x8FDE98u, r);
    }
    soe_carry(r, true);
}

SOE_BIND(sub_8CDD01, 0x8CDD01, RTS) {
    uint32_t pc = SOE_DPPTR(r, 0x82u);
    uint16_t x_tile = (uint16_t)LONG8(pc);
    pc++;
    uint16_t y_tile = (uint16_t)LONG8(pc);
    pc++;
    DP16(r, 0x82u) = (uint16_t)pc;
    DP16(r, 0x46u) = (uint16_t)(x_tile << 3);
    uint16_t y_val = (uint16_t)(y_tile << 3);
    DP16(r, 0x48u) = y_val;
    r->a = y_val;
    script_spawn_commit_bind(r);
}
