/*
 * $8F:C773 entity_sprite_depth (knowledge/rom/8fc773.md), RTL, 16-bit A and X. Runs on into
 * $8F:C780 sprite_depth_against_the_canopy, which is only reached by that branch (no call recorded).
 *
 * In: Y = an entity record (DB-relative). Builds the sprite's attribute word in DP $06 and its depth
 * in DP $08 (also rec[$84]); DP $02/$04 = the position relative to the camera (DP $59/$5B).
 *  - rec[$10] bit 10 with $23C1 set: priority attributes $CC30 straight away ($C773 only);
 *  - X = rec[$3C] (the metatile under it): gate nibble $8 in bits 11..8 hides it (depth 0);
 *  - its plane (rec[$3C] & $30) against the entity's (rec[$18] & $30): higher -> $CC30, lower ->
 *    $CC20; equal -> $CC30 when bit 12, else $CC20, or $FC20 with gate nibble $4;
 *  - +$0200 when rec[$0C] is 0 (TSB);
 *  - depth = ((plane ^ $30) << 1) + $40 + y-on-screen + carries, + $80; 0 when bit 9.. set (>= $200).
 * With plane 0 and $7E:241F = 2 the position is taken against $010E/$0110 instead (y + 1).
 */
#include "soe.h"

SOE_BIND(entity_sprite_depth, 0x8FC773, RTL)
{
    uint16_t y = r->y, a, x, attr;

    if ((ABSI16(r, 0x0010, y) & 0x0400) && ABS16(r, 0x23C1) != 0) {
        soe_nz16(r, ABS16(r, 0x23C1));
        attr = 0xCC30;
        goto attributes;
    }
    x = ABSI16(r, 0x003C, y);
    r->x = x;
    a = (uint16_t)(x ^ 0x0800);
    if ((a & 0x0F00) == 0) {                                 /* $C78C: hidden */
        soe_nz16(r, r->d);                                   /* TDC */
        DP16(r, 0x08) = r->d;
        ABSI16(r, 0x0084, y) = r->d;
        r->a = r->d;
        return;
    }
    DP16(r, 0x12) = (uint16_t)(a & 0x0030);
    soe_cmp16(r, (uint16_t)(ABSI16(r, 0x0018, y) & 0x0030), DP16(r, 0x12));
    if (r->p & SOE_Z) {                                      /* $C7A9 */
        if (x & 0x1000) attr = 0xCC30;
        else if (((x ^ 0x0400) & 0x0F00) == 0) attr = 0xFC20;
        else attr = 0xCC20;
    } else {
        attr = (r->p & SOE_N) ? 0xCC30 : 0xCC20;
    }
attributes:
    DP16(r, 0x06) = attr;
    a = ABSI16(r, 0x000C, y);
    if (a == 0) a = 0x0200;
    r->p = (uint8_t)((r->p & ~SOE_Z) | ((a & DP16(r, 0x06)) == 0 ? SOE_Z : 0));   /* TSB $06 */
    DP16(r, 0x06) = (uint16_t)(DP16(r, 0x06) | a);
    soe_carry(r, true);
    DP16(r, 0x02) = soe_sbc16(r, ABSI16(r, 0x001A, y), DP16(r, 0x59));
    soe_carry(r, true);
    DP16(r, 0x04) = soe_sbc16(r, ABSI16(r, 0x001C, y), DP16(r, 0x5B));
    a = (uint16_t)(ABSI16(r, 0x0018, y) & 0x0030);
    if (a == 0) {
        soe_cmp16(r, LONG16(0x7E241FUL), 0x0002);
        if (r->p & SOE_Z) {
            soe_carry(r, true);
            DP16(r, 0x02) = soe_sbc16(r, ABSI16(r, 0x001A, y), ABS16(r, 0x010E));
            soe_carry(r, true);
            DP16(r, 0x04) = (uint16_t)(soe_sbc16(r, ABSI16(r, 0x001C, y), ABS16(r, 0x0110)) + 1);
        }
        a = r->d;                                            /* TDC */
    }
    a ^= 0x0030;
    soe_carry(r, a & 0x8000);                                /* ASL A */
    a = (uint16_t)(a << 1);
    a = soe_adc16(r, a, 0x0040);
    a = soe_adc16(r, a, DP16(r, 0x04));
    if (a & 0xFE00) {
        a = r->d;                                            /* TDC */
        soe_nz16(r, a);
    } else {
        soe_carry(r, false);
        a = soe_adc16(r, a, 0x0080);
    }
    DP16(r, 0x08) = a;
    ABSI16(r, 0x0084, y) = a;
    r->a = a;
}

