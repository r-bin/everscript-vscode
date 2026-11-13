/*
 * $8C:D804 script_op_10_14_write_byte (knowledge/routines/script_op_10_14_write_byte.md), RTS, 16-bit A, X, Y.
 *
 * Evaluates an inline operand pointer offset from $7E:2258, consumes the 16-bit
 * inline offset word from [$82], evaluates the script expression via $8C:EA43,
 * and writes the result low byte to DB:target ($2258 + offset). Returns carry set.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_10_14_write_byte ($8CD804) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (24 bytes)
 * - Compiled C ASM:   127 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      66ca68f74ee9186b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

#define SCRIPT_PC_ADDR_DP 0x82u

SOE_BIND(script_op_10_14_write_byte, 0x8CD804, RTS)
{
    SOE_AT(0xD804);
    uint32_t pc = SOE_DPPTR(r, SCRIPT_PC_ADDR_DP);
    uint16_t inline_off = LONG16(pc);
    DP16(r, SCRIPT_PC_ADDR_DP) = (uint16_t)(DP16(r, SCRIPT_PC_ADDR_DP) + 2u);

    soe_carry(r, false);
    uint16_t target = soe_adc16(r, ALCHEMY_KNOWN_FLAGS_ADDR, inline_off);
    r->a = target;

    soe_call_rtl(0x8CEA43u, r);

    r->x = target;
    ABS8(r, target) = (uint8_t)r->a;
    soe_nz16(r, target);
    soe_carry(r, true);
}
