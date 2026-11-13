/**
 * Routine: $8C:DC9A (script_op_a2_spawn_at)
 * Bank: $8C (ROM Offset: $0CDC9A)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_a2_spawn_at ($8CDC9A) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  32 instructions (67 bytes)
 * - Compiled C ASM:   185 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b116dc73eb4cf3f5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_a2_spawn_at, 0x8CDC9A, RTS);

void script_op_a2_spawn_at_bind(soe_regs r) {
    uint16_t type_idx = LONG16(SOE_DPPTR(r, 0x82u));
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 2u);
    uint16_t type_id = ROM16(0x8EB55Au + type_idx);
    uint16_t flags = LONG16(SOE_DPPTR(r, 0x82u));
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 2u);
    soe_call_rtl(0x8CEA43u, r);
    uint16_t x_pos = r->a;
    soe_call_rtl(0x8CEA43u, r);
    DP16(r, 0x48u) = r->a;
    DP16(r, 0x46u) = x_pos;
    DP16(r, 0x08u) = flags;
    DP16(r, 0x02u) = type_id;
    soe_call_rts(0x8CDD19u, r);
}
