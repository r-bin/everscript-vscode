/*
 * $90:CE20 oam_dynamic_sprite_palette_slot_release (knowledge/routines/oam_dynamic_sprite_palette_slot_release.md), RTL, 16-bit A, X, Y.
 *
 * Scans active entity list ($3DDF) and companion list ($3DE1) to accumulate in-use dynamic sprite
 * palette mask bits into DP $12, then zeroes unreferenced palette slots ($1280, $1282, $1278, $127A).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   oam_dynamic_sprite_palette_slot_release ($90CE20) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  36 instructions (88 bytes)
 * - Compiled C ASM:   371 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5756d2b988f30057
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(oam_dynamic_sprite_palette_slot_release, 0x90CE20, RTL)
{
    SOE_AT(0xCE20);
    r->a = ABS16(r, ANIM_FRAME_HOLD_TIMER_ADDR);
    DP16(r, 0x12) = r->a;
    r->y = ABS16(r, ACTIVE_ENTITY_HEAD_ADDR);
    while (r->y != 0) {
        SOE_AT(0xCE2A);
        r->x = (uint16_t)(ABSI16(r, 0x0075, r->y) & 0x00FF);
        r->a = LONG16(0x80A8A1UL + r->x);
        DP16(r, 0x12) |= r->a;
        r->x = ABSI16(r, 0x005E, r->y);
        r->y = r->x;
    }
    SOE_AT(0xCE3D);
    r->y = ABS16(r, ACTIVE_COMPANION_HEAD_ADDR);
    while (r->y != 0) {
        SOE_AT(0xCE42);
        r->x = (uint16_t)(ABSI16(r, 0x0075, r->y) & 0x00FF);
        r->a = LONG16(0x80A8A1UL + r->x);
        DP16(r, 0x12) |= r->a;
        r->x = ABSI16(r, 0x005E, r->y);
        r->y = r->x;
    }
    SOE_AT(0xCE55);
    r->a = DP16(r, 0x12);
    soe_nz16(r, r->a);
    if ((r->a & 0x0010) == 0) {
        SOE_AT(0xCE5C);
        ABS16(r, PALETTE_CYCLE_STEP_3_ADDR) = 0;
    }
    SOE_AT(0xCE5F);
    if ((r->a & 0x0020) == 0) {
        SOE_AT(0xCE64);
        ABS16(r, PALETTE_CYCLE_STEP_4_ADDR) = 0;
    }
    SOE_AT(0xCE67);
    if ((r->a & 0x0001) == 0) {
        SOE_AT(0xCE6C);
        ABS16(r, SOUND_COMMAND_MAILBOX_ADDR) = 0;
    }
    SOE_AT(0xCE6F);
    soe_bit_imm(r, r->a, 0x0002);
    if ((r->a & 0x0002) == 0) {
        SOE_AT(0xCE74);
        ABS16(r, PALETTE_CYCLE_STEP_0_ADDR) = 0;
    }
    SOE_AT(0xCE77);
}
