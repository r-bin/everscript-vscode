/*
 * $8F:A999 elevation_compass_direction_resolve (knowledge/rom/8fa999.md), RTS, 8-bit accumulator.
 *
 * One of four direction codes from the signs of dx = DP $12 and dy = DP $13:
 * dx < 0: dy < 0 -> $0E, else $0A; dx >= 0: dy < 0 -> $02, else $06.
 * Leaves A low byte = the code (N and Z as LDA #code sets them), C and V as entered.
 */
#include "soe.h"

SOE_BIND(elevation_compass_direction_resolve, 0x8FA999, RTS)
{
    bool dx_neg = (DP8(r, 0x12) & 0x80) != 0;
    bool dy_neg = (DP8(r, 0x13) & 0x80) != 0;
    uint8_t code = dx_neg ? (dy_neg ? 0x0E : 0x0A) : (dy_neg ? 0x02 : 0x06);

    soe_set_a8(r, code);
    soe_nz8(r, code);
}
