/*
 * $80:9685 init_entity_pool (knowledge/rom/809685.md), RTL, 16-bit A and X.
 *
 * Links the 8-byte nodes $7E:50AF..$7E:5127 behind the head $7E:50A7 (head +4 = $FFFE): for each
 * node, the one before it gets +2 = the node and +6 = itself, the node gets +0 = the one before
 * and +4 = $FFFF. $7E:1276 = $512F (the end). DB is $7E during the work and restored. Leaves
 * A = $512F, X = Y = $5127, C set (CMP equal), V from the last ADC, N Z from the restored DB (PLB).
 */
#include "soe.h"

SOE_BIND(init_entity_pool, 0x809685, RTL)
{
    uint16_t x = 0x50A7, y;
    uint16_t a = 0x50AF;

    RAM16(x + 4) = 0xFFFE;
    soe_carry(r, false);
    do {
        y = a;
        RAM16(x + 2) = a;
        RAM16(x + 6) = x;
        RAM16(y + 0) = x;
        RAM16(y + 4) = 0xFFFF;
        x = y;
        a = soe_adc16(r, y, 0x0008);
        soe_cmp16(r, a, 0x512F);
    } while (a != 0x512F);
    RAM16(0x1276) = 0x512F;
    r->a = 0x512F;
    soe_nz8(r, r->db);                                       /* PLB */
    r->x = x;
    r->y = y;
}
