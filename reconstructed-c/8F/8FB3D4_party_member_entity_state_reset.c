/*
 * $8F:B3D4 party_member_entity_state_reset (knowledge/routines/party_member_entity_state_reset.md), RTS, 16-bit A, X, Y.
 *
 * Resets motion, combat impulse, and navigation state for a party member entity (Y = $4E89 Boy or $4F37 Dog):
 * 1. Attaches animation script descriptor X via $90:817B.
 * 2. Masks status flags +$10: (& $AFBE) | $0020.
 * 3. Masks status flags +$12: & $2886.
 * 4. Masks status flags +$14: & $F6DF.
 * 5. Clears motion/impulse/knockback fields: +$24, +$80, +$36, +$38, +$88, +$8A, +$68, +$1E, +$20, +$76.
 * 6. Sets target slot +$66 = $FFFF.
 * 7. If waypoint node +$6A >= 0, releases it via $8F:9916 and saves return ($FFFF).
 * 8. If waypoint node +$6C >= 0, releases it via $8F:9916 and saves return ($FFFF).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   party_member_entity_state_reset ($8FB3D4) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  33 instructions (96 bytes)
 * - Compiled C ASM:   679 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   20.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      99ea33a98c6d2230
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(party_member_entity_state_reset, 0x8FB3D4, RTS)
{
    uint16_t a;

    SOE_AT(0xB3D4);
    soe_call_rtl(0x90817BUL, r);

    SOE_AT(0xB3D8);
    a = (uint16_t)((ABSI16(r, 0x0010, r->y) & 0xAFBE) | 0x0020);
    ABSI16(r, 0x0010, r->y) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xB3E4);
    a = (uint16_t)(ABSI16(r, 0x0012, r->y) & 0x2886);
    ABSI16(r, 0x0012, r->y) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xB3ED);
    a = (uint16_t)(ABSI16(r, 0x0014, r->y) & 0xF6DF);
    ABSI16(r, 0x0014, r->y) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xB3F6);
    r->a = 0;
    soe_nz16(r, 0);
    ABSI16(r, 0x0024, r->y) = 0;
    ABSI16(r, 0x0080, r->y) = 0;
    ABSI16(r, 0x0036, r->y) = 0;
    ABSI16(r, 0x0038, r->y) = 0;
    ABSI16(r, 0x0088, r->y) = 0;
    ABSI16(r, 0x008A, r->y) = 0;
    ABSI16(r, 0x0068, r->y) = 0;
    ABSI16(r, 0x001E, r->y) = 0;
    ABSI16(r, 0x0020, r->y) = 0;
    ABSI16(r, 0x0076, r->y) = 0;

    SOE_AT(0xB415);
    r->a = 0xFFFF;
    soe_nz16(r, 0xFFFF);
    ABSI16(r, 0x0066, r->y) = 0xFFFF;

    SOE_AT(0xB41B);
    r->x = ABSI16(r, 0x006A, r->y);
    soe_nz16(r, r->x);
    if (!(r->p & SOE_N)) {
        SOE_AT(0xB420);
        soe_call_rtl(0x8F9916UL, r);
        ABSI16(r, 0x006A, r->y) = r->a;
    }

    SOE_AT(0xB427);
    r->x = ABSI16(r, 0x006C, r->y);
    soe_nz16(r, r->x);
    if (!(r->p & SOE_N)) {
        SOE_AT(0xB42C);
        soe_call_rtl(0x8F9916UL, r);
        ABSI16(r, 0x006C, r->y) = r->a;
    }
}

