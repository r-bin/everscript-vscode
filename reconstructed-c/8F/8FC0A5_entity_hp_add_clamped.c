/*
 * $8F:C0A5 entity_hp_add_clamped (knowledge/routines/entity_hp_add_clamped.md), RTL, 16-bit A and X.
 *
 * Adds A to entity's current HP (+$2A,Y) and clamps it to maximum HP from $8E:000F,X where X = +$60,Y.
 * If entity Y >= $4E89 (party entity), calls $8F:9144 (hud_render_entity_hp_string).
 * Clears pending damage (+$76,Y = TDC) and clears flags $0478 from reaction flags +$12,Y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_hp_add_clamped ($8FC0A5) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  19 instructions (46 bytes)
 * - Compiled C ASM:   242 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      2f7efcb448578a58
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_hp_add_clamped, 0x8FC0A5, RTL)
{
    uint16_t y = r->y;
    uint8_t db = r->db;
    uint16_t x;
    uint16_t a;
    uint16_t max_hp;

    SOE_AT(0xC0A5);
    x = ABSI16(r, 0x0060, y);
    r->x = x;

    soe_carry(r, false);
    a = soe_adc16(r, r->a, ABSI16(r, 0x002A, y));
    max_hp = ROM16(0x8E000FUL + x);
    soe_cmp16(r, a, max_hp);
    if (!(r->p & SOE_N)) {
        SOE_AT(0xC0B2);
        a = max_hp;
    }

    SOE_AT(0xC0B6);
    ABSI16(r, 0x002A, y) = a;
    soe_cmp16(r, y, 0x4E89);
    if (r->p & SOE_C) {
        SOE_AT(0xC0BE);
        r->x = y;
        soe_call_rtl(0x8F9144UL, r);
        r->y = y;                                            /* PLY at $8F:C0C4 */
        r->db = db;
    }

    SOE_AT(0xC0C5);
    a = r->d;
    soe_nz16(r, a);
    ABSI16(r, 0x0076, y) = a;

    SOE_AT(0xC0C9);
    a = (uint16_t)(ABSI16(r, 0x0012, y) & 0xFB87);
    ABSI16(r, 0x0012, y) = a;
    r->a = a;
    soe_nz16(r, a);
}
