/*
 * $8F:A914 update_entity_plane (knowledge/rom/8fa914.md), RTL, 16-bit accumulator.
 *
 * In: A = a metatile collision word. Out: the entity plane word in DP $44.
 *  - bits $2040 clear: $44 = A & $0030 (plane bits 5..4);
 *  - bit $0040 clear (so bit $2000 set): $44 = (A & $0030) | $0040;
 *  - bit $0040 set: $44 &= ~$0040 (TRB), A = $0040.
 * Leaves A = the value written (or $0040), N Z from it (TRB: Z = no bit 6 in the old $44); X Y C V as entered.
 */
#include "soe.h"

#ifndef SOE_OPTIMIZE

SOE_BIND(update_entity_plane, 0x8FA914, RTL)
{
    uint16_t a = r->a;

    if ((a & 0x2040) == 0) {
        a &= 0x0030;
        soe_nz16(r, a);
        DP16(r, 0x44) = a;
    } else if ((a & 0x0040) == 0) {
        a = (uint16_t)((a & 0x0030) | 0x0040);
        soe_nz16(r, a);
        DP16(r, 0x44) = a;
    } else {
        uint16_t old = DP16(r, 0x44);
        a = 0x0040;
        soe_nz16(r, a);                       /* LDA #$0040: N clear */
        DP16(r, 0x44) = (uint16_t)(old & ~a);
        r->p = (uint8_t)((r->p & ~SOE_Z) | ((old & a) == 0 ? SOE_Z : 0));
    }
    r->a = a;
}

#else /* SOE_OPTIMIZE: a faster variant of the same behaviour (G1-checked); the code above is the documentation */

SOE_BIND(update_entity_plane, 0x8FA914, RTL)
{
    uint8_t SOE_FAR *dp = SOE_DIRECT(r);
    uint16_t a = r->a;
    uint8_t p;

    if ((a & 0x2040) == 0) {
        a &= 0x0030;
        DPB16(dp, 0x44) = a;
        p = soe_p_nz16(r->p, a);
    } else if ((a & 0x0040) == 0) {
        a = (uint16_t)((a & 0x0030) | 0x0040);
        DPB16(dp, 0x44) = a;
        p = soe_p_nz16(r->p, a);
    } else {
        uint16_t old = DPB16(dp, 0x44);
        a = 0x0040;
        DPB16(dp, 0x44) = (uint16_t)(old & ~a);
        p = (uint8_t)(r->p & ~(SOE_N | SOE_Z));              /* LDA #$0040: N clear; TRB: Z */
        if ((old & a) == 0) p |= SOE_Z;
    }
    r->a = a;
    r->p = p;
}

#endif /* SOE_OPTIMIZE */
