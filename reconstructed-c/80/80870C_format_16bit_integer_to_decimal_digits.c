/*
 * $80:870C format_16bit_integer_to_decimal_digits (knowledge/routines/format_16bit_integer_to_decimal_digits.md), RTL, 16-bit A.
 *
 * Formats a 16-bit unsigned integer into BCD decimal digits at DP $02, terminated by $FF:
 * 1. Sets DB = $80, index registers 8-bit.
 * 2. Determines digit count in [1..5] by magnitude (<10, <100, <1000, <10000).
 * 3. Writes $FF sentinel at DP $02 + digit_count.
 * 4. Successively divides by 10 (via hardware registers $4204/$4206), writing remainder
 *    digits from right to left into DP $02..$02+digit_count-1.
 * 5. Restores DB and 16-bit index registers.
 * Leaves A = 0, X = digit_count, Y = first digit, N Z from restored DB, Carry = (val >= 10000).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   format_16bit_integer_to_decimal_digits ($80870C) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  43 instructions (75 bytes)
 * - Compiled C ASM:   304 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      771023d2665cfca5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(format_16bit_integer_to_decimal_digits, 0x80870C, RTL)
{
    uint8_t entry_db = r->db;
    uint16_t val = r->a;
    uint8_t count = 1;
    int8_t x;
    uint8_t last_digit = 0;

    SOE_AT(0x870C);
    r->p |= SOE_X;
    r->db = 0x80;

    SOE_AT(0x8713);
    if (val >= 10) {
        SOE_AT(0x871A);
        count = 2;
        if (val >= 100) {
            SOE_AT(0x8720);
            count = 3;
            if (val >= 1000) {
                SOE_AT(0x8726);
                count = 4;
                if (val >= 10000) {
                    SOE_AT(0x872C);
                    count = 5;
                }
            }
        }
    }
    soe_carry(r, val >= 10000);

    SOE_AT(0x872D);
    DP8(r, 0x02 + count) = 0xFF;

    x = (int8_t)(count - 1);
    while (x >= 0) {
        uint16_t quot;
        uint8_t rem;

        SOE_AT(0x8734);
        ABS16(r, 0x4204) = val;
        ABS8(r, 0x4206) = 10;

        quot = (uint16_t)(val / 10);
        rem = (uint8_t)(val % 10);
        last_digit = rem;

        DP8(r, 0x02 + x) = rem;
        val = quot;
        x--;
    }

    SOE_AT(0x8751);
    r->a = 0;
    r->x = count;
    r->y = last_digit;
    r->p &= ~SOE_X;
    r->db = entry_db;
    soe_nz8(r, entry_db);
}

