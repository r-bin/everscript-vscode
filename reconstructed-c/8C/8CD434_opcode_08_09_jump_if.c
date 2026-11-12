/*
 * $8C:D434 — script_jump_rel16
 * $8C:D465 — script_op_08_jump_if_true (RTS)
 * $8C:D474 — script_op_09_jump_if_false (RTS)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_09_jump_if_false ($8CD474) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  34 instructions (64 bytes)
 * - Compiled C ASM:   60 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   1.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b4b5cb3e04fcb015
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static void script_jump_rel16(soe_regs r)
{
    uint8_t b0 = LONG8(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82));
    uint8_t lo = (uint8_t)(DP8(r, 0x82) + 1u);
    DP8(r, 0x82) = lo;
    if (lo == 0) {
        DP8(r, 0x83) = (uint8_t)(DP8(r, 0x83) + 1u);
    }
    uint8_t b1 = LONG8(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82));
    uint16_t off = (uint16_t)(((uint16_t)b1 << 8) | b0);

    r->p |= SOE_C;
    uint16_t sum = soe_adc16(r, off, DP16(r, 0x82));
    if ((off & 0x8000u) != 0) {
        if ((sum & 0x8000u) == 0) {
            sum |= 0x8000u;
            DP16(r, 0x84) = (uint16_t)(DP16(r, 0x84) - 1u);
            soe_nz16(r, sum);
        }
    } else {
        if ((sum & 0x8000u) == 0) {
            sum |= 0x8000u;
            DP16(r, 0x84) = (uint16_t)(DP16(r, 0x84) + 1u);
            soe_nz16(r, sum);
        }
    }
    r->a = sum;
    DP16(r, 0x82) = sum;
    r->p |= SOE_C;
}

SOE_BIND(script_op_08_jump_if_true, 0x8CD465, RTS);
void script_op_08_jump_if_true_bind(soe_regs r)
{
    soe_call_rtl(0x8CEA43u, r);
    if (r->a == 0) {
        uint16_t pc = (uint16_t)(DP16(r, 0x82) + 2u);
        DP16(r, 0x82) = pc;
        soe_nz16(r, pc);
        r->p |= SOE_C;
        return;
    }
    script_jump_rel16(r);
}

SOE_BIND(script_op_09_jump_if_false, 0x8CD474, RTS);
void script_op_09_jump_if_false_bind(soe_regs r)
{
    soe_call_rtl(0x8CEA43u, r);
    if (r->a != 0) {
        uint16_t pc = (uint16_t)(DP16(r, 0x82) + 2u);
        DP16(r, 0x82) = pc;
        soe_nz16(r, pc);
        r->p |= SOE_C;
        return;
    }
    script_jump_rel16(r);
}
