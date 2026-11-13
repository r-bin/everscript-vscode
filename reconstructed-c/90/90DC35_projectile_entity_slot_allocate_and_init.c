/*
 * $90:DC35 — projectile_entity_slot_allocate_and_init (RTS)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_entity_slot_allocate_and_init ($90DC35) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  43 instructions (111 bytes)
 * - Compiled C ASM:   401 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c1d9d82f75c408e2
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(projectile_entity_slot_allocate_and_init, 0x90DC35, RTS);
void projectile_entity_slot_allocate_and_init_bind(soe_regs r)
{
    uint16_t slot = RAM16(0x0EC2u);
    r->y = slot;
    uint16_t next = (uint16_t)(slot + 0x002Cu);
    if (next >= 0x64E7u) {
        r->p |= SOE_C;
        next = 0x6387u;
    } else {
        r->p &= (uint8_t)~SOE_C;
    }
    RAM16(0x0EC2u) = next;

    uint16_t owner = DP16(r, 0x4C);
    RAM16((uint16_t)(slot + 0x0010u)) = owner;
    r->x = owner;
    RAM16((uint16_t)(slot + 0x001Au)) = RAM16((uint16_t)(owner + 0x0022u));
    RAM16((uint16_t)(slot + 0x000Cu)) = RAM16((uint16_t)(owner + 0x000Cu));
    RAM16((uint16_t)(slot + 0x0014u)) = DP16(r, 0x46);
    RAM16((uint16_t)(slot + 0x0016u)) = DP16(r, 0x48);
    RAM16((uint16_t)(slot + 0x0018u)) = DP16(r, 0x4A);

    uint16_t tbl = DP16(r, 0x06);
    r->x = tbl;
    uint16_t v16 = ROM16(0x900000u + (uint16_t)(tbl + 0x0016u));
    if (v16 == 0) {
        r->x = owner;
        soe_call_rtl(0x8FC02Bu, r);
        v16 = r->a;
    }
    RAM16((uint16_t)(slot + 0x0028u)) = v16;

    r->x = tbl;
    RAM16((uint16_t)(slot + 0x002Au)) = ROM16(0x900000u + (uint16_t)(tbl + 0x0014u));

    uint16_t v0 = ROM16(0x900000u + tbl);
    if (v0 != 0) {
        r->x = v0;
        r->a = RAM16((uint16_t)(slot + 0x001Au));
        soe_call_rtl(0x90819Au, r);
        r->x = tbl;
    }

    uint16_t v2 = ROM16(0x900000u + (uint16_t)(tbl + 2u));
    if (v2 != 0) {
        r->a = v2;
        soe_call_rtl(0x90CD80u, r);
        r->a = r->x;
        RAM16((uint16_t)(slot + 0x000Cu)) = r->x;
        r->x = tbl;
        soe_nz16(r, r->x);
    } else {
        r->a = 0;
        soe_nz16(r, 0);
    }
}

