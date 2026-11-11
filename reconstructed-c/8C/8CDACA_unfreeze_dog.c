/**
 * Routine: $8C:DACA (unfreeze_dog)
 * Bank: $8C (ROM Offset: $0CDACA)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   unfreeze_dog ($8CDACA) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (59 bytes)
 * - Compiled C ASM:   184 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      e59a35fec2882148
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_dp.h"
#include "soe_ram.h"

#define ENTITY_SELECT_BOY_BIT   0x0001u
#define ENTITY_SELECT_DOG_BIT   0x0002u
#define ENTITY_SELECT_CHILD_BIT 0x0008u

SOE_BIND(unfreeze_dog, 0x8CDACA, RTS);

/**
 * Unfreezes the companion dog entity via $8F:CD4D using the shared entity-mask
 * unfreeze helper ($8C:DADB) with mask 0x0002.
 */
void unfreeze_dog_bind(soe_regs r) {
    uint16_t mask = ENTITY_SELECT_DOG_BIT;
    DP16(r, 0x02u) = mask;
    r->a = mask;

    if (mask & ENTITY_SELECT_CHILD_BIT) {
        uint16_t boy_child = ABS16(r, (uint16_t)(DP16(r, 0x7Eu) + 0x000Du));
        if (boy_child != 0u) {
            r->y = boy_child;
            DP16(r, DP_PARENT_ENTITY) = boy_child;
            soe_nz16(r, boy_child);
            soe_call_rtl(0x8FCD4Du, r);
            mask = DP16(r, 0x02u);
        }
    }
    if (mask & ENTITY_SELECT_BOY_BIT) {
        r->y = ENTITY_PLAYER_BOY_ADDR;
        DP16(r, DP_PARENT_ENTITY) = ENTITY_PLAYER_BOY_ADDR;
        r->a = mask & ENTITY_SELECT_BOY_BIT;
        soe_nz16(r, r->a);
        soe_call_rtl(0x8FCD4Du, r);
        mask = DP16(r, 0x02u);
    }
    if (mask & ENTITY_SELECT_DOG_BIT) {
        r->y = ENTITY_COMPANION_DOG_ADDR;
        DP16(r, DP_PARENT_ENTITY) = ENTITY_COMPANION_DOG_ADDR;
        r->a = mask & ENTITY_SELECT_DOG_BIT;
        soe_nz16(r, r->a);
        soe_call_rtl(0x8FCD4Du, r);
    }

    soe_carry(r, true);
}
