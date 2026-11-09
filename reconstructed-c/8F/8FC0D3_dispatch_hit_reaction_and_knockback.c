/*
 * $8F:C0D3 dispatch_hit_reaction_and_knockback (knowledge/routines/dispatch_hit_reaction_and_knockback.md), RTL, 16-bit A and X.
 *
 * Applies damage and hit reactions to victim entity Y with incoming damage in A.
 * If target has invulnerability/death flags set in +$10,Y or +$14,Y, clears damage in $7E:0EA0 and returns.
 * Otherwise sets hit reaction flags in +$12,Y (0x0438 or 0x0080), halves damage if flag 0x2000 is set,
 * clamps damage to 999 ($03E7), and accumulates into target pending damage buffer +$76,Y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   dispatch_hit_reaction_and_knockback ($8FC0D3) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  30 instructions (78 bytes)
 * - Compiled C ASM:   457 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   15.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      499c90a71633bb04
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(dispatch_hit_reaction_and_knockback, 0x8FC0D3, RTL)
{
    uint16_t a;

    SOE_AT(0xC0D3);
    RAM16(0x0EA0) = r->a;

    SOE_AT(0xC0D6);
    a = ABSI16(r, 0x0010, r->y);
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC0D9);
    soe_bit_imm(r, a, 0x4000);
    if (!(r->p & SOE_Z)) {
        goto exit_zero;
    }

    SOE_AT(0xC0DE);
    a = ABSI16(r, 0x0014, r->y);
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC0E1);
    soe_bit_imm(r, a, 0x010D);
    if (!(r->p & SOE_Z)) {
        goto exit_zero;
    }

    SOE_AT(0xC0E6);
    soe_bit_imm(r, a, 0x0002);
    if (!(r->p & SOE_Z)) {
        SOE_AT(0xC0EB);
        a = (uint16_t)(ABSI16(r, 0x0012, r->y) | 0x0080);
        ABSI16(r, 0x0012, r->y) = a;
        r->a = a;
        soe_nz16(r, a);
        goto exit_zero;
    }

    SOE_AT(0xC0F6);
    a = (uint16_t)(ABSI16(r, 0x0012, r->y) | 0x0438);
    ABSI16(r, 0x0012, r->y) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC0FF);
    soe_bit_imm(r, a, 0x2000);
    if (!(r->p & SOE_Z)) {
        uint16_t dmg;
        SOE_AT(0xC104);
        dmg = RAM16(0x0EA0);
        soe_carry(r, (dmg & 1) != 0);
        dmg = (uint16_t)(dmg >> 1);
        RAM16(0x0EA0) = dmg;
        soe_nz16(r, dmg);
    }

    SOE_AT(0xC107);
    a = RAM16(0x0EA0);
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC10A);
    soe_cmp16(r, a, 0x03E8);
    if (r->p & SOE_C) {
        SOE_AT(0xC10F);
        a = 0x03E7;
        r->a = a;
        soe_nz16(r, a);
    }

    SOE_AT(0xC112);
    RAM16(0x0EA0) = a;

    SOE_AT(0xC115);
    soe_carry(r, false);
    a = soe_adc16(r, a, ABSI16(r, 0x0076, r->y));
    ABSI16(r, 0x0076, r->y) = a;
    r->a = a;
    return;

exit_zero:
    SOE_AT(0xC11D);
    RAM16(0x0EA0) = 0;
}

