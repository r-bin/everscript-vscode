/**
 * Routine: $8C:D7B3 (script_op_1a_1e_write_local_word)
 * Bank: $8C (ROM Offset: $0CD7B3)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_1a_1e_write_local_word ($8CD7B3) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  20 instructions (36 bytes)
 * - Compiled C ASM:   193 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      82013ee718a4ec67
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_1a_1e_write_local_word, 0x8CD7B3, RTS);

void script_op_1a_1e_write_local_word_bind(soe_regs r) {
    uint16_t base = (uint16_t)(DP16(r, 0x7Eu) + 0x000Fu);
    uint8_t off = LONG8(SOE_DPPTR(r, 0x82u));
    r->p &= (uint8_t)~SOE_C;
    uint8_t new_lo = soe_adc8(r, (uint8_t)base, off);
    uint8_t pc_lo = (uint8_t)(DP8(r, 0x82u) + 1u);
    DP8(r, 0x82u) = pc_lo;
    if (pc_lo == 0u) {
        DP8(r, 0x83u) = (uint8_t)(DP8(r, 0x83u) + 1u);
    }
    uint8_t new_hi = soe_adc8(r, (uint8_t)(base >> 8), 0u);
    uint16_t target_addr = (uint16_t)((new_hi << 8) | new_lo);
    soe_call_rtl(0x8CEA43u, r);
    r->x = target_addr;
    soe_nz16(r, target_addr);
    ABSI16(r, 0x0000u, r->x) = r->a;
    soe_carry(r, true);
}
