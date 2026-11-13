/**
 * Routine: $90:824B (entity_anim_set_walk)
 * Bank: $90 (ROM Offset: $10824B)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_anim_set_walk ($90824B) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  47 instructions (115 bytes)
 * - Compiled C ASM:   117 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   2.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      68eab1de5ea0e61f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_dp.h"

#define ENTITY_TYPE_WALK_ANIM_ROM   0x8E0034u
#define ENTITY_TYPE_IDLE_ANIM_ROM   0x8E0032u

SOE_BIND(entity_anim_set_walk, 0x90824B, RTL);

/**
 * Selects walk or idle animation script ID from the parent entity's $8E:0000
 * descriptor based on movement state (+0x64) and tail-jumps to $90:8124.
 */
void entity_anim_set_walk_bind(soe_regs r) {
    uint16_t entity = DP16(r, DP_PARENT_ENTITY);
    uint16_t type_desc = ABS16(r, (uint16_t)(entity + 0x0060u));
    uint16_t moving = (uint16_t)(ABS16(r, (uint16_t)(entity + 0x0064u)) & 0x00FFu);

    uint16_t anim_id = (moving != 0u)
        ? ROM16(ENTITY_TYPE_WALK_ANIM_ROM + type_desc)
        : ROM16(ENTITY_TYPE_IDLE_ANIM_ROM + type_desc);

    r->y = entity;
    r->a = anim_id;
    r->x = anim_id;
    soe_nz16(r, anim_id);
    soe_call_rtl(0x908124u, r);
}
