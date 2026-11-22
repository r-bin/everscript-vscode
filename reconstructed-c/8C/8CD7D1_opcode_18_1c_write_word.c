/*
 * $8C:D7D1 script_op_18_1c_write_word (knowledge/routines/script_op_18_1c_write_word.md), RTS, 16-bit A, X, Y.
 *
 * Evaluates an inline operand pointer offset from $7E:2258, consumes the 16-bit
 * inline offset word from [$82], evaluates the script expression via $8C:EA43,
 * and writes the result word to DB:target ($2258 + offset). Returns carry set.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_18_1c_write_word ($8CD7D1) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  11 instructions (21 bytes)
 * - Compiled C ASM:   127 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      cdcbc2351521e8b3
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

#define SCRIPT_PC_ADDR_DP 0x82u

SOE_BIND(script_op_18_1c_write_word, 0x8CD7D1, RTS)
{
    SOE_AT(0xD7D1);
    uint32_t pc = SOE_DPPTR(r, SCRIPT_PC_ADDR_DP);
    uint16_t inline_off = LONG16(pc);
    DP16(r, SCRIPT_PC_ADDR_DP) = (uint16_t)(DP16(r, SCRIPT_PC_ADDR_DP) + 2u);

    soe_carry(r, false);
    uint16_t target = soe_adc16(r, ALCHEMY_KNOWN_FLAGS_ADDR, inline_off);
    r->a = target;

    soe_call_rtl(0x8CEA43u, r);

    r->x = target;
    ABS16(r, target) = r->a;
    soe_nz16(r, target);
    soe_carry(r, true);
}
