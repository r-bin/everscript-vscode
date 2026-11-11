/**
 * Routine: $90:8317 (anim_select_attack_tier3)
 * Bank: $90 (ROM Offset: $108317)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   anim_select_attack_tier3 ($908317) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  67 instructions (162 bytes)
 * - Compiled C ASM:   278 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      9310090cd22021f3
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

#define AMMO_BASED_ATTACK_ANIM_ID 0x41CAu
#define UNARMED_FALLBACK_ANIM_ID  0x3EEEu
#define ANIM_RECORD_ROM_BASE      0xC40000u
#define ANIM_MIRROR_FACING_BIT    0x4000u
#define ANIM_FACING_SWAP_TABLE    0x90815Bu

SOE_BIND(anim_select_attack_tier3, 0x908317, RTL);

/**
 * Dispatches attack animation A on entity DB:Y: returns immediately if A == 0,
 * consumes Bazooka ammo if A == $41CA (falling back to $3EEE when empty),
 * toggles mirrored facing if the animation record carries bit $4000, and
 * tail-jumps to entity_set_flag_0040 ($90:811B).
 */
void anim_select_attack_tier3_bind(soe_regs r) {
    uint16_t anim_id = r->a;
    if (r->p & SOE_Z) {
        return;
    }

    if (anim_id == AMMO_BASED_ATTACK_ANIM_ID) {
        uint16_t ammo_idx = (uint16_t)((ABS16(r, AMMO_SELECTED_TYPE_ADDR) & 0x00FEu) >> 1);
        r->x = ammo_idx;
        uint8_t count = (uint8_t)ABS16(r, (uint16_t)(AMMO_THUNDER_BALL_ADDR + ammo_idx));
        if (count == 0u) {
            anim_id = UNARMED_FALLBACK_ANIM_ID;
            soe_carry(r, true);
        } else {
            ABS8(r, (uint16_t)(AMMO_THUNDER_BALL_ADDR + ammo_idx)) = (uint8_t)(count - 1u);
            r->p &= (uint8_t)~(SOE_M | SOE_X);
            soe_carry(r, true);
            anim_id = AMMO_BASED_ATTACK_ANIM_ID;
        }
    } else {
        soe_carry(r, anim_id >= AMMO_BASED_ATTACK_ANIM_ID);
    }

    r->x = anim_id;
    uint16_t rec_hi = ROM16(ANIM_RECORD_ROM_BASE + anim_id + 2u);
    r->a = rec_hi;
    soe_bit_imm(r, rec_hi, ANIM_MIRROR_FACING_BIT);
    if (rec_hi & ANIM_MIRROR_FACING_BIT) {
        DP16(r, 0x12u) = anim_id;
        uint16_t facing = ABS16(r, (uint16_t)(r->y + 0x0022u));
        uint16_t flipped = ROM16(ANIM_FACING_SWAP_TABLE + facing);
        ABS16(r, (uint16_t)(r->y + 0x0022u)) = flipped;
        r->a = flipped;
    }

    soe_nz16(r, r->a);
    soe_call_rtl(0x90811Bu, r);
}
