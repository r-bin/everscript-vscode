/*
 * $8F:B29B entity_linked_list_validate_entity (knowledge/routines/entity_linked_list_validate_entity.md), RTS, 16-bit A, X, Y.
 *
 * Move active entity $4C to front of linked list rooted at anchor:
 * In: X = current search node / anchor, Y = list anchor head.
 * 1. Pushes Y (list anchor).
 * 2. Traverses forward pointer chain +$5E,X; if chain ends with 0 without finding $4C, triggers BRK/STP.
 * 3. When found (Y == $4C):
 *    - CPY $4C sets carry flag (Y >= $4C).
 *    - Unlinks node: prev->next = curr->next.
 *    - Pulls anchor into X.
 *    - Slices node to head: curr->next = anchor->next; anchor->next = curr.
 * Leaves A = curr, X = anchor, Y = curr, N Z from curr, Carry = 1 from CPY.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_linked_list_validate_entity ($8FB29B) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  19 instructions (42 bytes)
 * - Compiled C ASM:   228 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      674387e6177477eb
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_linked_list_validate_entity, 0x8FB29B, RTS)
{
    uint16_t anchor = r->y;
    uint16_t prev = r->x;
    uint16_t curr;
    uint16_t target = DP16(r, 0x4C);

    SOE_AT(0xB29B);
    curr = ABSI16(r, 0x005E, prev);
    r->y = curr;
    soe_nz16(r, curr);

    while (curr != target) {
        if (curr == 0) {
            SOE_AT(0xB2AB);
            soe_stp();
            return;
        }
        SOE_AT(0xB2A5);
        prev = curr;
        r->x = prev;
        curr = ABSI16(r, 0x005E, prev);
        r->y = curr;
        soe_nz16(r, curr);
    }

    SOE_AT(0xB2A1);
    /* CPY $4C sets Carry because curr == target (curr >= target) */
    soe_carry(r, true);

    SOE_AT(0xB2AC);
    /* prev->next = curr->next */
    ABSI16(r, 0x005E, prev) = ABSI16(r, 0x005E, curr);

    SOE_AT(0xB2B2);
    /* PLX pulls original anchor into X */
    r->x = anchor;

    /* curr->next = anchor->next */
    ABSI16(r, 0x005E, curr) = ABSI16(r, 0x005E, anchor);

    SOE_AT(0xB2B9);
    /* TYA sets N Z from curr; anchor->next = curr */
    r->a = curr;
    r->y = curr;
    soe_nz16(r, curr);
    ABSI16(r, 0x005E, anchor) = curr;
}
