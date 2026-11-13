/*
 * $8C:D967 script_window_record_operand (knowledge/routines/script_window_record_operand.md), RTS.
 *
 * Reads a dialogue window ID byte from [$82], multiplies by $2C (44-byte record stride) via
 * hardware multiplier $4202, and returns the record offset $034D + id * $2C in A.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_window_record_operand ($8CD967) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (21 bytes)
 * - Compiled C ASM:   113 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      2a21a52658bd5c3b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_window_record_operand, 0x8CD967, RTS)
{
    uint8_t id = (uint8_t)(LONG16(SOE_DPPTR(r, 0x82)) & 0x00FFu);
    uint16_t prod;
    uint16_t res;

    ABS16(r, 0x4202) = (uint16_t)(0x2C00u | id);
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1u);
    prod = ABS16(r, 0x4216);

    soe_carry(r, false);
    res = soe_adc16(r, 0x034Du, prod);
    r->a = res;
}

