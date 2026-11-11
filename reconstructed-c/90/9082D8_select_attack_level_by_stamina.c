/**
 * Routine: $90:82D8 (select_attack_level_by_stamina)
 * Bank: $90 (ROM Offset: $1082D8)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   select_attack_level_by_stamina ($9082D8) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  89 instructions (225 bytes)
 * - Compiled C ASM:   218 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   2.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c3097cd8d1e014f4
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_dp.h"

#define STAMINA_TIER1_THRESHOLD    0x0400u
#define STAMINA_TIER2_THRESHOLD    0x0800u
#define STAMINA_TIER3_THRESHOLD    0x0C00u
#define ENTITY_FLAG_CHARGED_ATK    0x0200u
#define ENTITY_ATK_ANIM_TIER0_ROM  0x8E0038u
#define ENTITY_ATK_ANIM_TIER1_ROM  0x8E003Au
#define ENTITY_ATK_ANIM_TIER2_ROM  0x8E003Cu
#define ENTITY_ATK_ANIM_TIER3_ROM  0x8E003Eu

SOE_BIND(select_attack_level_by_stamina, 0x9082D8, RTL);

/**
 * Chooses the entity attack animation slot ($8E:0038..$8E:003E) according to
 * current stamina at +0x2E, marks charged attack flag $0200 when stamina >=
 * $0800, and tail-calls anim_select_attack_tier3 ($90:8317).
 */
void select_attack_level_by_stamina_bind(soe_regs r) {
    uint16_t entity = DP16(r, DP_PARENT_ENTITY);
    uint16_t type_desc = ABS16(r, (uint16_t)(entity + 0x0060u));
    uint16_t stamina = ABS16(r, (uint16_t)(entity + 0x002Eu));
    uint16_t anim_id;

    r->y = entity;
    r->x = type_desc;

    if (stamina < STAMINA_TIER1_THRESHOLD) {
        anim_id = ROM16(ENTITY_ATK_ANIM_TIER0_ROM + type_desc);
        soe_carry(r, false);
    } else if (stamina < STAMINA_TIER2_THRESHOLD) {
        anim_id = ROM16(ENTITY_ATK_ANIM_TIER1_ROM + type_desc);
        soe_carry(r, false);
    } else if (stamina < STAMINA_TIER3_THRESHOLD) {
        ABS16(r, (uint16_t)(entity + 0x0014u)) |= ENTITY_FLAG_CHARGED_ATK;
        anim_id = ROM16(ENTITY_ATK_ANIM_TIER2_ROM + type_desc);
        soe_carry(r, false);
    } else {
        ABS16(r, (uint16_t)(entity + 0x0014u)) |= ENTITY_FLAG_CHARGED_ATK;
        anim_id = ROM16(ENTITY_ATK_ANIM_TIER3_ROM + type_desc);
        soe_carry(r, true);
    }

    r->a = anim_id;
    soe_nz16(r, anim_id);
    soe_call_rtl(0x908317u, r);
}
