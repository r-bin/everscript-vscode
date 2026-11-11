/**
 * Routine: $8C:D7CC (script_op_19_1d_write_temp_word)
 * Bank: $8C (ROM Offset: $0CD7CC)
 * Calling convention: RTS (16-bit A/X/Y)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_19_1d_write_temp_word ($8CD7CC) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (23 bytes)
 * - Compiled C ASM:   127 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b33db4d7765e76b5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

#define SCRIPT_PC_ADDR_DP 0x82u

SOE_BIND(script_op_19_1d_write_temp_word, 0x8CD7CC, RTS);

/**
 * Evaluates an inline operand pointer offset from $7E:2834, consumes the 16-bit
 * inline offset word, evaluates the following script expression ($8C:EA43),
 * and writes the result to DB:target.
 */
void script_op_19_1d_write_temp_word_bind(soe_regs r) {
    uint32_t pc = SOE_DPPTR(r, SCRIPT_PC_ADDR_DP);
    uint16_t inline_off = LONG16(pc);
    DP16(r, SCRIPT_PC_ADDR_DP) = (uint16_t)(DP16(r, SCRIPT_PC_ADDR_DP) + 2u);

    soe_carry(r, false);
    uint16_t target = soe_adc16(r, TEMP_COMPILER_ARENA_ADDR, inline_off);
    r->a = target;

    soe_call_rtl(0x8CEA43u, r);

    r->x = target;
    ABS16(r, target) = r->a;
    soe_nz16(r, target);
    soe_carry(r, true);
}
