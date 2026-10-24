/*
 * $8F:C02B scale_damage_by_stamina (knowledge/rom/8fc02b.md), RTL, 16-bit A and X.
 *
 * In: X = the attacker's record (DB-relative). The base value: the Boy ($4E89) with weapon $0ABA =
 * $1A uses $1468; everyone else the word at $8E:0019 + rec[$60] (the character template). Scaled by
 * the stamina charge rec[$2E]: < $200 -> /4, < $400 -> /2, < $800 -> x1, < $C00 -> x2, else x4
 * (each "<" is CPY's N flag). X and Y are kept. Leaves A = the value, N Z from the restored Y (PLY),
 * C from the last shift or CPY.
 */
#include "soe.h"

SOE_BIND(scale_damage_by_stamina, 0x8FC02B, RTL)
{
    uint16_t x = r->x, a, charge;
    int8_t shift;
    bool boy_weapon = false;

    soe_cmp16(r, x, 0x4E89);
    if (r->p & SOE_Z) {
        soe_cmp16(r, ABS16(r, 0x0ABA), 0x001A);
        boy_weapon = (r->p & SOE_Z) != 0;
    }
    a = boy_weapon ? ABS16(r, 0x1468) : LONG16(0x8E0019UL + ABSI16(r, 0x0060, x));
    charge = ABSI16(r, 0x002E, x);
    shift = 0;                                               /* < 0: right, > 0: left */
    soe_cmp16(r, charge, 0x0200);
    if (r->p & SOE_N) {
        shift = -2;
    } else {
        soe_cmp16(r, charge, 0x0400);
        if (r->p & SOE_N) {
            shift = -1;
        } else {
            soe_cmp16(r, charge, 0x0800);
            if (!(r->p & SOE_N)) {
                soe_cmp16(r, charge, 0x0C00);
                shift = (r->p & SOE_N) ? 1 : 2;
            }
        }
    }
    for (; shift < 0; shift++) { soe_carry(r, a & 1); a >>= 1; }                         /* LSR A */
    for (; shift > 0; shift--) { soe_carry(r, a & 0x8000); a = (uint16_t)(a << 1); }     /* ASL A */
    r->a = a;
    soe_nz16(r, r->y);                                       /* PLY */
}
