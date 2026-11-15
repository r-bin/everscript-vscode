/**
 * Routine: $8C:D7CC (script_op_19_1d_write_temp_word)
 * Bank: $8C (ROM Offset: $0CD7CC)
 * Calling convention: RTS (16-bit A/X/Y)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CD7DB ($8CD7DB) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (11 bytes)
 * - Compiled C ASM:   149 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   24.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      de2053eed12c1fce
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

#define SCRIPT_PC_ADDR_DP 0x82u

SOE_BIND(script_op_19_1d_write_temp_word, 0x8CD7CC, RTS);
SOE_BIND(sub_8CD7D4, 0x8CD7D4, RTS);
SOE_BIND(sub_8CD7DB, 0x8CD7DB, RTS);

/**
 * Evaluates an inline operand pointer offset from $7E:2834, consumes the 16-bit
 * inline offset word, evaluates the following script expression ($8C:EA43),
 * and writes the result to DB:target.
 */
void sub_8CD7DB_bind(soe_regs r) {
    uint16_t target = r->a;
    soe_call_rtl(0x8CEA43u, r);
    r->x = target;
    ABS16(r, target) = r->a;
    soe_nz16(r, target);
    soe_carry(r, true);
}

void sub_8CD7D4_bind(soe_regs r) {
    uint32_t pc = SOE_DPPTR(r, SCRIPT_PC_ADDR_DP);
    uint16_t inline_off = LONG16(pc);
    DP16(r, SCRIPT_PC_ADDR_DP) = (uint16_t)(DP16(r, SCRIPT_PC_ADDR_DP) + 2u);
    soe_carry(r, false);
    r->a = soe_adc16(r, r->a, inline_off);
    sub_8CD7DB_bind(r);
}

void script_op_19_1d_write_temp_word_bind(soe_regs r) {
    r->a = TEMP_COMPILER_ARENA_ADDR;
    sub_8CD7D4_bind(r);
}