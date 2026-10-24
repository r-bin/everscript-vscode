/*
 * $8F:AF0E collision_step_success_commit (knowledge/rom/8faf0e.md), RTL, 16-bit A.
 *
 * Sets bit 0 of the word at Y + $12 (DB-relative entity record). Leaves A = the new word, N Z from it.
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(collision_step_success_commit, 0x8FAF0E, RTL)
{
    uint16_t a = (uint16_t)(ABSI16(r, ENTITY_RECORD_STATE_OFF, r->y) | 0x0001);

    ABSI16(r, ENTITY_RECORD_STATE_OFF, r->y) = a;
    r->a = a;
    soe_nz16(r, a);
}
