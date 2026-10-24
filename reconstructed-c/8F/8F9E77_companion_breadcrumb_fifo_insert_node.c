/*
 * $8F:9E77 companion_breadcrumb_fifo_insert_node (knowledge/rom/8f9e77.md), RTL, 16-bit A and X.
 *
 * In: DP $4E = a follower record (X), Y = the byte offset where a 3-byte breadcrumb is to go.
 * rec[$3BFF] (the list end) grows by 3; n = old end - Y - 1. n >= 0: the n + 1 bytes from Y on move
 * up by 3 (MVP $7E,$7E from $3BC9+old end-1 down). Leaves A = the old end, N Z from it, DB = $7E
 * after a move.
 */
#include "soe.h"

#ifndef SOE_OPTIMIZE

SOE_BIND(companion_breadcrumb_fifo_insert_node, 0x8F9E77, RTL)
{
    uint16_t x = DP16(r, 0x4E);
    uint16_t old = ABSI16(r, 0x3BFF, x);
    uint16_t n;

    r->x = x;
    soe_carry(r, false);
    ABSI16(r, 0x3BFF, x) = soe_adc16(r, old, 0x0003);
    soe_carry(r, false);
    n = soe_sbc16(r, old, r->y);                             /* PHY / CLC / SBC $01,s */
    if (!(n & 0x8000)) {
        uint16_t src;
        soe_carry(r, false);
        src = (uint16_t)(soe_adc16(r, old, 0x3BC9) - 1);     /* ADC / DEC A: carry from the ADC */
        r->x = src;
        r->y = soe_adc16(r, src, 0x0003);
        r->a = n;
        soe_mvp(r, 0x7E, 0x7E);
    }
    r->a = old;                                              /* PLA */
    soe_nz16(r, old);
}

#else /* SOE_OPTIMIZE: a faster variant of the same behaviour (G1-checked); the code above is the documentation */

SOE_BIND(companion_breadcrumb_fifo_insert_node, 0x8F9E77, RTL)
{
    uint8_t SOE_FAR *bank = SOE_BANK(r);
    uint16_t x = DPB16(SOE_DIRECT(r), 0x4E);
    uint16_t old = BANKI16(bank, 0x3BFF, x), grown, n;
    uint8_t p = r->p;

    r->x = x;
    grown = (uint16_t)(old + 3);                             /* PHA / CLC / ADC #3 */
    BANKI16(bank, 0x3BFF, x) = grown;
    n = (uint16_t)(old - r->y - 1);                          /* PHY / CLC / SBC $01,s */
    p = soe_flags_sub16(p, old, r->y, n, 0, false);
    if (!(n & 0x8000)) {
        uint16_t sum = (uint16_t)(old + 0x3BC9), src, dst;   /* CLC / ADC #$3BC9 / DEC A / TAX */
        uint16_t c = sum < old;
        src = (uint16_t)(sum - 1);
        dst = (uint16_t)(src + 3 + c);                       /* ADC #3: the carry of the first ADC */
        p = soe_flags_add16(p, src, 3, dst, c ? dst <= src : dst < src);
        r->x = src;
        r->y = dst;
        r->a = n;
        r->p = p;
        soe_mvp_7e(r);
        p = r->p;
    }
    r->a = old;                                              /* PLA */
    r->p = soe_p_nz16(p, old);
}

#endif /* SOE_OPTIMIZE */
