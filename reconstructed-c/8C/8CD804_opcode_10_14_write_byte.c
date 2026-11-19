/*
 * $8C:D807 sub_8CD807 (knowledge/routines/sub_8CD807.md), RTS, 16-bit A, X, Y.
 *
 * Shared byte-write execution core for script opcodes 0x10, 0x11, 0x14, 0x15:
 * Evaluates an inline operand pointer offset added to incoming A ($2258 or $2834),
 * consumes the 16-bit inline offset word from [$82], evaluates the following
 * script expression ($8C:EA43), and writes the low byte of the result to DB:target.
 * Returns with carry set and N/Z set from target (PLX).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CD807 ($8CD807) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  11 instructions (21 bytes)
 * - Compiled C ASM:   133 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      394b007f9cff7419
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

#define SCRIPT_PC_ADDR_DP 0x82u

SOE_BIND(sub_8CD807, 0x8CD807, RTS)
{
    SOE_AT(0xD807);
    uint32_t pc = SOE_DPPTR(r, SCRIPT_PC_ADDR_DP);
    uint16_t inline_off = LONG16(pc);
    DP16(r, SCRIPT_PC_ADDR_DP) = (uint16_t)(DP16(r, SCRIPT_PC_ADDR_DP) + 2u);

    soe_carry(r, false);
    uint16_t target = soe_adc16(r, r->a, inline_off);
    r->a = target;

    soe_call_rtl(0x8CEA43u, r);

    r->x = target;
    soe_nz16(r, target);
    ABS8(r, target) = (uint8_t)r->a;
    r->p |= SOE_C;
    r->p &= (uint8_t)~(SOE_M | SOE_X);
}
