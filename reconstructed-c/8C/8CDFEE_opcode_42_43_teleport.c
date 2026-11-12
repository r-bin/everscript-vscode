/**
 * Routine: $8C:DFEE (script_op_42_teleport_tile)
 * Bank: $8C (ROM Offset: $0CDFEE)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_42_teleport_tile ($8CDFEE) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  33 instructions (66 bytes)
 * - Compiled C ASM:   220 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c8517e87b31dc964
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_42_teleport_tile, 0x8CDFEE, RTS);

void script_op_42_teleport_tile_bind(soe_regs r) {
    soe_call_rtl(0x8CEC8Eu, r);
    uint16_t packed = LONG16(SOE_DPPTR(r, 0x82u));
    DP16(r, 0x82u) = (uint16_t)(DP16(r, 0x82u) + 2u);
    r->y = packed;
    DP16(r, 0x46u) = (uint16_t)((packed & 0x00FFu) << 3);
    DP16(r, 0x48u) = (uint16_t)(((packed >> 8) & 0x00FFu) << 3);
    r->y = DP16(r, 0x4Cu);
    uint16_t flags = ABSI16(r, 0x0010u, r->y);
    r->a = flags;
    if ((flags & 0x0008u) == 0u) {
        uint16_t layer = ABS16(r, 0x23DBu);
        r->a = layer;
        if (layer & 0x8000u) {
            soe_call_rtl(0x8FC2D1u, r);
        } else {
            DP16(r, 0x44u) = layer;
            r->a = 0xFFFFu;
            soe_nz16(r, 0xFFFFu);
            ABS16(r, 0x23DBu) = 0xFFFFu;
            soe_call_rtl(0x8FC2E4u, r);
        }
    }
    soe_carry(r, true);
}
