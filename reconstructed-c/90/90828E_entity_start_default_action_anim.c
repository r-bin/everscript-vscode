/**
 * Routine: $90:828E (entity_start_default_action_anim)
 * Bank: $90 (ROM Offset: $10828E)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_start_default_action_anim ($90828E) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  41 instructions (99 bytes)
 * - Compiled C ASM:   76 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   1.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      24555f66c8e57cec
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_dp.h"

#define ENTITY_TYPE_IDLE_ANIM_ROM 0x8E0032u

SOE_BIND(entity_start_default_action_anim, 0x90828E, RTL);

/**
 * Loads the default idle animation ID ($8E:0032,x) for parent entity $4C and
 * tail-jumps to anim_start_record ($90:8124).
 */
void entity_start_default_action_anim_bind(soe_regs r) {
    uint16_t entity = DP16(r, DP_PARENT_ENTITY);
    uint16_t type_desc = ABS16(r, (uint16_t)(entity + 0x0060u));
    uint16_t anim_id = ROM16(ENTITY_TYPE_IDLE_ANIM_ROM + type_desc);

    r->y = entity;
    r->a = anim_id;
    r->x = anim_id;
    soe_nz16(r, anim_id);
    soe_call_rtl(0x908124u, r);
}
