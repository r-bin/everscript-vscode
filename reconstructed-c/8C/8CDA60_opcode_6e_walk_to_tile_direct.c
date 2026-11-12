/**
 * Routine: $8C:DA60 (script_op_6e_walk_to_tile_direct)
 * Bank: $8C (ROM Offset: $0CDA60)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_6e_walk_to_tile_direct ($8CDA60) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  33 instructions (69 bytes)
 * - Compiled C ASM:   235 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8e94be6266b29d9d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_6e_walk_to_tile_direct, 0x8CDA60, RTS);

void script_op_6e_walk_to_tile_direct_bind(soe_regs r) {
    DP16(r, 0x12u) = 0x0001u;
    soe_call_rtl(0x8CEC8Eu, r);
    uint16_t tx = (uint16_t)((LONG16(SOE_DPPTR(r, 0x82u)) & 0x00FFu) << 3);
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 1u);
    DP16(r, 0x46u) = tx;
    uint16_t ty = (uint16_t)((LONG16(SOE_DPPTR(r, 0x82u)) & 0x00FFu) << 3);
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 1u);
    DP16(r, 0x48u) = ty;
    r->y = DP16(r, 0x4Cu);
    if (r->y >= 0x4E89u || ABSI16(r, 0x002Au, r->y) == 0u) {
        r->a = 0u;
        soe_nz16(r, 0u);
        r->y = DP16(r, 0x12u);
        if (r->y != 0u) {
            soe_call_rtl(0x8FAAD3u, r);
        } else {
            soe_call_rtl(0x8FAA82u, r);
        }
    }
    soe_carry(r, true);
}
