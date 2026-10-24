/*
 * $8F:A97D elevation_manhattan_distance_eval (knowledge/rom/8fa97d.md), RTS, 8-bit accumulator.
 *
 * Signed bytes dx = DP $12, dy = DP $13. Signs differ: |dx + dy|; signs match: |dx - dy|, in 8 bits
 * (the sum or difference wraps; a result of $80 stays $80). Leaves A low byte = the result; C and V
 * from the ADC/SBC, N and Z from the last instruction that set them.
 */
#include "soe.h"

SOE_BIND(elevation_manhattan_distance_eval, 0x8FA97D, RTS)
{
    uint8_t dx = DP8(r, 0x12), dy = DP8(r, 0x13);
    uint8_t a;

    if ((dx ^ dy) & 0x80) {
        soe_carry(r, false);
        a = soe_adc8(r, dx, dy);
    } else {
        soe_carry(r, true);
        a = soe_sbc8(r, dx, dy);
    }
    if (a & 0x80) {                     /* EOR #$FF / INC A */
        a = (uint8_t)(0 - a);
        soe_nz8(r, a);
    }
    soe_set_a8(r, a);
}
