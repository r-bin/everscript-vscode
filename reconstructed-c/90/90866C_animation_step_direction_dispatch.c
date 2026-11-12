/**
 * Routine: $90:866C (animation_step_direction_dispatch)
 * Bank: $90 (ROM Offset: $10866C)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_step_direction_dispatch ($90866C) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  31 instructions (61 bytes)
 * - Compiled C ASM:   341 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      d01a1fd1102a1722
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(animation_step_direction_dispatch, 0x90866C, RTS);

void animation_step_direction_dispatch_bind(soe_regs r) {
    uint8_t step = LONG8(SOE_DPPTR(r, 0x5Du));
    if ((step & 0x80u) == 0u) {
        r->p &= (uint8_t)~SOE_C;
        uint8_t val = (uint8_t)(soe_adc8(r, step, ABS8(r, 0x0F36u)) >> 2);
        r->p &= (uint8_t)~(SOE_M | SOE_X);
        uint16_t a16 = (uint16_t)((r->a & 0xFF00u) | val);
        DP16(r, 0x02u) = a16;
        DP16(r, 0x04u) = ABSI16(r, 0x0022u, r->y);
        soe_call_rtl(0x8FAD51u, r);
        DP16(r, 0x5Du) = (uint16_t)(DP16(r, 0x5Du) + 1u);
        r->p |= SOE_M;
        r->y = DP16(r, 0x4Cu);
        soe_nz16(r, r->y);
        soe_carry(r, false);
    } else {
        uint8_t neg = (uint8_t)(step ^ 0xFFu);
        r->p |= SOE_C;
        uint8_t sum = soe_adc8(r, neg, ABS8(r, 0x0F36u));
        uint8_t val = (uint8_t)(sum >> 2);
        r->p &= (uint8_t)~(SOE_M | SOE_X);
        uint16_t a16 = (uint16_t)((r->a & 0xFF00u) | val);
        DP16(r, 0x02u) = a16;
        DP16(r, 0x04u) = (uint16_t)(ABSI16(r, 0x0022u, r->y) ^ 0x0008u);
        soe_call_rtl(0x8FAD51u, r);
        uint16_t pc = (uint16_t)(DP16(r, 0x5Du) + 1u);
        DP16(r, 0x5Du) = pc;
        soe_nz16(r, pc);
        r->p |= SOE_M;
        soe_carry(r, false);
    }
}
