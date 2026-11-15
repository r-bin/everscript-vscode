/**
 * Routine: $8C:DACA (unfreeze_dog)
 * Bank: $8C (ROM Offset: $0CDACA)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CDADB ($8CDADB) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  22 instructions (54 bytes)
 * - Compiled C ASM:   189 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f3ccc4c8771739a1
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_dp.h"
#include "soe_ram.h"

#define ENTITY_SELECT_BOY_BIT   0x0001u
#define ENTITY_SELECT_DOG_BIT   0x0002u
#define ENTITY_SELECT_CHILD_BIT 0x0008u

SOE_BIND(unfreeze_dog, 0x8CDACA, RTS);
SOE_BIND(sub_8CDADB, 0x8CDADB, RTS);

void sub_8CDADB_bind(soe_regs r) {
    uint16_t mask = r->a;
    DP16(r, 0x02u) = mask;

    if (mask & ENTITY_SELECT_CHILD_BIT) {
        uint16_t x = DP16(r, 0x7Eu);
        r->x = x;
        soe_nz16(r, x);
        uint16_t boy_child = ABSI16(r, 0x000Du, x);
        r->y = boy_child;
        soe_nz16(r, boy_child);
        if (boy_child != 0u) {
            DP16(r, DP_PARENT_ENTITY) = boy_child;
            soe_call_rtl(0x8FCD4Du, r);
            mask = DP16(r, 0x02u);
            r->a = mask;
        }
    }
    if (mask & ENTITY_SELECT_BOY_BIT) {
        r->y = ENTITY_PLAYER_BOY_ADDR;
        DP16(r, DP_PARENT_ENTITY) = ENTITY_PLAYER_BOY_ADDR;
        soe_call_rtl(0x8FCD4Du, r);
        mask = DP16(r, 0x02u);
        r->a = mask;
    }
    if (mask & ENTITY_SELECT_DOG_BIT) {
        r->y = ENTITY_COMPANION_DOG_ADDR;
        DP16(r, DP_PARENT_ENTITY) = ENTITY_COMPANION_DOG_ADDR;
        soe_call_rtl(0x8FCD4Du, r);
    } else {
        r->p |= SOE_Z;
    }

    soe_carry(r, true);
}

void unfreeze_dog_bind(soe_regs r) {
    r->a = ENTITY_SELECT_DOG_BIT;
    sub_8CDADB_bind(r);
}
