/*
 * $91:98EE alchemy_all_slots_frame_tick (knowledge/routines/alchemy_all_slots_frame_tick.md), RTL, 16-bit A and X.
 *
 * Master per-frame tick for active alchemy slots. Sweeps the 8 animation alchemy slots ($7E:3364..$7E:3564,
 * stride $40) and 8 projectile alchemy slots ($7E:3564..$7E:3914, stride $76). For each active slot (+14,Y != 0),
 * sets DP $4C from +$28,Y and executes $91:9750.
 * Leaves A = Y = $3914, C set, N Z from the restored DB (PLB).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   alchemy_all_slots_frame_tick ($9198EE) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  32 instructions (68 bytes)
 * - Compiled C ASM:   291 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8a71b957b4dbabd5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(alchemy_all_slots_frame_tick, 0x9198EE, RTL)
{
    uint16_t y;
    uint16_t x;
    uint16_t a;

    SOE_AT(0x98EE);
    /* Loop 1: Animation alchemy slots */
    y = 0x3364;
    while (true) {
        SOE_AT(0x98F7);
        x = RAM16(y + 0x14);
        r->x = x;
        if (x != 0) {
            SOE_AT(0x98FC);
            a = RAM16(y + 0x28);
            DP16(r, 0x4C) = a;
            r->a = a;
            r->y = y;
            r->db = 0x7E;
            soe_call_rtl(0x919750UL, r);
            y = r->y;
            if (r->p & SOE_C) {
                SOE_AT(0x9905);
                continue;
            }
        }

        SOE_AT(0x9907);
        a = y;
        soe_carry(r, false);
        a = soe_adc16(r, a, 0x0040);
        y = a;
        r->y = y;
        soe_cmp16(r, y, 0x3564);
        if (r->p & SOE_N) {
            SOE_AT(0x9910);
            continue;
        }
        break;
    }

    SOE_AT(0x9912);
    /* Loop 2: Projectile alchemy slots */
    y = 0x3564;
    while (true) {
        SOE_AT(0x9915);
        x = RAM16(y + 0x14);
        r->x = x;
        if (x != 0) {
            SOE_AT(0x991A);
            a = RAM16(y + 0x28);
            DP16(r, 0x4C) = a;
            r->a = a;
            r->y = y;
            r->db = 0x7E;
            soe_call_rtl(0x919750UL, r);
            y = r->y;
            if (r->p & SOE_C) {
                SOE_AT(0x9923);
                continue;
            }
        }

        SOE_AT(0x9925);
        a = y;
        soe_carry(r, false);
        a = soe_adc16(r, a, 0x0076);
        y = a;
        r->y = y;
        soe_cmp16(r, y, 0x3914);
        if (r->p & SOE_N) {
            SOE_AT(0x992E);
            continue;
        }
        break;
    }

    /* Exit: PLB restores DB and sets N and Z */
    soe_nz8(r, r->db);
    r->a = a;
    r->y = y;
    /* Carry is set from CPY #$3914 */
    soe_carry(r, true);
}

