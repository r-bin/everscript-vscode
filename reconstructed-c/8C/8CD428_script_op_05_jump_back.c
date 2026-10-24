/*
 * $8C:D428 script_op_05_jump_back (knowledge/rom/8cd428.md), RTS, 16-bit A.
 *
 * The script pointer is the 24-bit DP $82..$84 (upper bank halves). Reads the byte at the pointer
 * (and the one after it, unused but read as a word), steps the pointer by one, then jumps back by
 * (that byte | $FF00) - 2 + 1... exactly: A = (word | $FF00) - 2, then pointer = pointer + A with
 * carry clear (shared tail $8C:D44A with script_jump_relative). Leaving the upper half wraps into the
 * previous bank: $8000 set again and the 16-bit word at $84 decremented. Leaves C = 1 (SEC).
 */
#include "soe.h"

/* $8C:D44A: pointer += a (+ carry); a backward step below $8000 goes to the bank before */
void soe_script_jump_back_tail(soe_regs r, uint16_t a);
void soe_script_jump_back_tail(soe_regs r, uint16_t a)
{
    a = soe_adc16(r, a, DP16(r, 0x82));
    if (!(a & 0x8000)) {
        uint16_t bank;
        a |= 0x8000;
        bank = (uint16_t)(DP16(r, 0x84) - 1);
        DP16(r, 0x84) = bank;
        soe_nz16(r, bank);
    }
    DP16(r, 0x82) = a;
    soe_carry(r, true);
    r->a = a;
}

SOE_BIND(script_op_05_jump_back, 0x8CD428, RTS)
{
    uint16_t a = LONG16(SOE_DPPTR(r, 0x82));

    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1);           /* INC $82: the word */
    a = (uint16_t)((a | 0xFF00) - 2);
    soe_carry(r, false);
    soe_script_jump_back_tail(r, a);
}
