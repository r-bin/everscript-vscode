/*
 * $8F:B1AC combat_hitbox_tables_and_collision_init (knowledge/routines/combat_hitbox_tables_and_collision_init.md), RTL, 16-bit A, X, Y.
 *
 * Initializes combat entity collision structures, projectile slots, and hitbox bounding boxes:
 * 1. Switches DB to $7E (preserves old DB on stack).
 * 2. Calls projectile/alchemy/sound/forage reset routines ($90D7CB, $90DC21, $8FDF14, $8FB28D).
 * 3. Clears combat registers ($1074, $1070, $1072, $2533, $3DDF, $0EA2, $4E59, $4E0B).
 * 4. Initializes entity free list links for 29 entity slots at $3DE5 (stride $8E).
 * 5. Initializes 6 combat slot bounds entries at $3BC9,X / $3C14,X (stride $59).
 * 6. Restores DB and exits with A = $FFFF, X = $01BD, Y = 0, C=0, flags from pulled DB.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   combat_hitbox_tables_and_collision_init ($8FB1AC) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  49 instructions (125 bytes)
 * - Compiled C ASM:   631 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      504eff16b5ea7ee3
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(combat_hitbox_tables_and_collision_init, 0x8FB1AC, RTL)
{
    uint8_t old_db;
    uint16_t a;
    uint16_t x;
    uint16_t y;

    SOE_AT(0xB1AC);
    old_db = r->db;
    r->db = 0x7E;

    SOE_AT(0xB1B2);
    soe_call_rtl(0x90D7CBUL, r);

    SOE_AT(0xB1B6);
    soe_call_rtl(0x90DC21UL, r);

    SOE_AT(0xB1BA);
    soe_call_rtl(0x8FDF14UL, r);

    SOE_AT(0xB1BE);
    ABS16(r, 0x1074) = 0;

    SOE_AT(0xB1C1);
    ABS16(r, 0x1070) = 0;

    SOE_AT(0xB1C4);
    ABS16(r, 0x1072) = 0;

    SOE_AT(0xB1C7);
    ABS16(r, 0x2533) = 0;

    SOE_AT(0xB1CA);
    a = 0x8000;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xB1CD);
    ABS16(r, 0x23DF) = a;

    SOE_AT(0xB1D0);
    ABS16(r, 0x23E1) = a;

    SOE_AT(0xB1D3);
    soe_call_rtl(0x8FB28DUL, r);

    SOE_AT(0xB1D7);
    ABS16(r, 0x3DDF) = 0;

    SOE_AT(0xB1DA);
    a = 0x3DE5;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xB1DD);
    ABS16(r, 0x0EBC) = a;

    SOE_AT(0xB1E0);
    ABS16(r, 0x0EA2) = 0;

    SOE_AT(0xB1E3);
    a = 0xFFFF;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xB1E6);
    ABS16(r, 0x0EAC) = a;

    SOE_AT(0xB1E9);
    ABS16(r, 0x4E59) = 0;

    SOE_AT(0xB1EC);
    ABS16(r, 0x4E0B) = 0;

    SOE_AT(0xB1EF);
    a = 0x3DE5;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xB1F2);
    ABS16(r, 0x3DE3) = a;

    SOE_AT(0xB1F5);
    y = 0x001D;
    r->y = y;
    soe_nz16(r, y);

    SOE_AT(0xB1F8);
    soe_carry(r, false);

    do {
        SOE_AT(0xB1F9);
        x = a;
        r->x = x;
        soe_nz16(r, x);

        SOE_AT(0xB1FA);
        a = soe_adc16(r, a, 0x008E);
        r->a = a;

        SOE_AT(0xB1FD);
        ABS16(r, (uint16_t)(x + 0x005E)) = a;

        SOE_AT(0xB200);
        ABS16(r, (uint16_t)(x + 0x0010)) = 0;

        SOE_AT(0xB203);
        y--;
        r->y = y;
        soe_nz16(r, y);
    } while (y != 0);

    SOE_AT(0xB206);
    y = 0x0005;
    r->y = y;
    soe_nz16(r, y);

    SOE_AT(0xB209);
    a = 0x0000;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xB20C);
    ABS16(r, 0x3BC7) = a;

    SOE_AT(0xB20F);
    soe_carry(r, false);

    do {
        SOE_AT(0xB210);
        x = a;
        r->x = x;
        soe_nz16(r, x);

        SOE_AT(0xB211);
        a = soe_adc16(r, a, 0x0059);
        r->a = a;

        SOE_AT(0xB214);
        ABS16(r, (uint16_t)(0x3BC9 + x)) = a;

        SOE_AT(0xB217);
        ABS16(r, (uint16_t)(0x3C14 + x)) = 0;

        SOE_AT(0xB21A);
        y--;
        r->y = y;
        soe_nz16(r, y);
    } while (y != 0);

    SOE_AT(0xB21D);
    x = a;
    r->x = x;
    soe_nz16(r, x);

    SOE_AT(0xB21E);
    a = 0xFFFF;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xB221);
    ABS16(r, (uint16_t)(0x3BC9 + x)) = a;

    SOE_AT(0xB224);
    ABS16(r, (uint16_t)(0x3C14 + x)) = 0;

    SOE_AT(0xB227);
    r->db = old_db;
    soe_nz8(r, old_db);
}

