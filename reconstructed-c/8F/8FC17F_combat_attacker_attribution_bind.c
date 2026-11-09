/*
 * $8F:C17F combat_attacker_attribution_bind (knowledge/routines/combat_attacker_attribution_bind.md), RTL, 16-bit A and X.
 *
 * Binds attacker entity in DP $4C to victim entity Y:
 * 1. Sets victim target +$24,Y and last attacker +$80,Y to attacker.
 * 2. If victim is player (Y >= $4E89), updates $7E:4EAD (Boy) and $7E:4F5B (Dog) with attacker pointer.
 * 3. If victim is enemy (Y < $4E89), updates $7E:4EAD and $7E:4F5B with victim pointer, then traverses
 *    the active entity list ($7E:3DDF) and assigns all entities of the same species to target the attacker
 *    (pack retaliation mechanic).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   combat_attacker_attribution_bind ($8FC17F) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  28 instructions (60 bytes)
 * - Compiled C ASM:   337 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      65c4d65b940410db
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(combat_attacker_attribution_bind, 0x8FC17F, RTL)
{
    uint16_t a;
    uint16_t victim;
    uint16_t victim_species;
    uint16_t curr;

    SOE_AT(0xC17F);
    r->x = DP16(r, 0x4C);
    soe_nz16(r, r->x);

    SOE_AT(0xC181);
    a = r->x;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC182);
    ABSI16(r, 0x0024, r->y) = a;

    SOE_AT(0xC185);
    ABSI16(r, 0x0080, r->y) = a;

    SOE_AT(0xC188);
    soe_cmp16(r, r->y, 0x4E89);
    if (r->p & SOE_C) {
        SOE_AT(0xC1B4);
        RAM16(0x4EAD) = r->x;
        SOE_AT(0xC1B7);
        RAM16(0x4F5B) = r->x;
        return;
    }

    SOE_AT(0xC18D);
    RAM16(0x4EAD) = r->y;

    SOE_AT(0xC190);
    RAM16(0x4F5B) = r->y;

    SOE_AT(0xC193);
    victim = r->y;

    SOE_AT(0xC194);
    victim_species = ABSI16(r, 0x0060, victim);
    r->a = victim_species;
    soe_nz16(r, victim_species);

    SOE_AT(0xC198);
    curr = RAM16(0x3DDF);
    r->y = curr;
    soe_nz16(r, curr);

    while (curr != 0) {
        SOE_AT(0xC19B);
        a = ABSI16(r, 0x0060, curr);
        r->a = a;
        soe_nz16(r, a);

        SOE_AT(0xC19E);
        soe_cmp16(r, a, victim_species);
        if (!(r->p & SOE_Z)) {
            goto next_node;
        }

        SOE_AT(0xC1A2);
        soe_cmp16(r, a, ABSI16(r, 0x0060, r->x));
        if (r->p & SOE_Z) {
            goto next_node;
        }

        SOE_AT(0xC1A7);
        a = r->x;
        r->a = a;
        soe_nz16(r, a);

        SOE_AT(0xC1A8);
        ABSI16(r, 0x0024, curr) = a;

    next_node:
        SOE_AT(0xC1AB);
        a = ABSI16(r, 0x005E, curr);
        curr = a;
        r->y = curr;
        r->a = a;
        soe_nz16(r, a);
    }

    SOE_AT(0xC1B1);
    r->a = victim_species;
    soe_nz16(r, victim_species);

    SOE_AT(0xC1B2);
    r->y = victim;
    soe_nz16(r, victim);
}

